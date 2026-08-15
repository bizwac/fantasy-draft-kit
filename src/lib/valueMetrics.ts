import { rosterSlotCount } from "./draftMath";
import type { Player, Position, RosterSlots } from "./types";

// VORP/tiers/auction-$ depend on a specific draft's settings (team count,
// roster slots) — two drafts with different settings would want different
// numbers for the same player. The shared `players` store holds one
// record per player across all drafts, so these are deliberately never
// persisted there (Player.vorp/tier/auctionValue stay null in storage).
// Instead everything here is a pure function of (players, draft settings),
// recomputed client-side per draft board.

const FLEX_ELIGIBLE: Position[] = ["RB", "WR", "TE"];
const SUPERFLEX_ELIGIBLE: Position[] = ["QB", "RB", "WR", "TE"];
const ALL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

// How many starters of each position the league actually needs, spreading
// FLEX/SUPERFLEX demand evenly across their eligible positions. This is a
// simplifying assumption (real leagues skew FLEX toward RB/WR) but it's
// transparent and shifts correctly with league settings, which is what
// the spec asks for (§4.8: "recompute replacement level from actual
// league settings, not hardcoded").
export function starterDemand(rosterSlots: RosterSlots): Record<Position, number> {
  const demand: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  demand.QB += rosterSlots.QB;
  demand.RB += rosterSlots.RB;
  demand.WR += rosterSlots.WR;
  demand.TE += rosterSlots.TE;
  demand.K += rosterSlots.K;
  demand.DST += rosterSlots.DST;

  const flex = rosterSlots.FLEX ?? 0;
  for (const pos of FLEX_ELIGIBLE) demand[pos] += flex / FLEX_ELIGIBLE.length;

  const superflex = rosterSlots.SUPERFLEX ?? 0;
  for (const pos of SUPERFLEX_ELIGIBLE) demand[pos] += superflex / SUPERFLEX_ELIGIBLE.length;

  return demand;
}

export function replacementRanks(rosterSlots: RosterSlots, teams: number): Record<Position, number> {
  const demand = starterDemand(rosterSlots);
  const ranks = {} as Record<Position, number>;
  for (const pos of ALL_POSITIONS) {
    ranks[pos] = Math.max(1, Math.round(teams * demand[pos]));
  }
  return ranks;
}

export function replacementLevels(players: Player[], rosterSlots: RosterSlots, teams: number): Record<Position, number> {
  const ranks = replacementRanks(rosterSlots, teams);
  const levels = {} as Record<Position, number>;
  for (const pos of ALL_POSITIONS) {
    const ranked = players
      .filter((p) => p.position === pos && p.projPoints !== null)
      .sort((a, b) => (b.projPoints as number) - (a.projPoints as number));
    const idx = ranks[pos] - 1;
    const at = ranked[idx] ?? ranked[ranked.length - 1];
    levels[pos] = at?.projPoints ?? 0;
  }
  return levels;
}

export function computeVorp(players: Player[], levels: Record<Position, number>): Map<string, number> {
  const vorp = new Map<string, number>();
  for (const p of players) {
    if (p.projPoints === null) continue;
    vorp.set(p.id, p.projPoints - levels[p.position]);
  }
  return vorp;
}

export interface AuctionValueOptions {
  teams: number;
  rosterSlots: RosterSlots;
  budget?: number;
}

// Standard "dollars over baseline" conversion: every roster spot reserves
// a $1 floor bid, and the rest of the league's total budget is split
// across the draftable pool in proportion to VORP.
export function computeAuctionValues(
  players: Player[],
  vorp: Map<string, number>,
  { teams, rosterSlots, budget = 200 }: AuctionValueOptions
): Map<string, number> {
  const rosterSize = rosterSlotCount(rosterSlots);
  const poolSize = teams * rosterSize;
  const draftPool = teams * budget;
  const spendable = Math.max(0, draftPool - poolSize * 1);

  const ranked = players
    .filter((p) => vorp.has(p.id))
    .sort((a, b) => (vorp.get(b.id) as number) - (vorp.get(a.id) as number))
    .slice(0, poolSize);

  const totalPositiveVorp = ranked.reduce((sum, p) => sum + Math.max(0, vorp.get(p.id) as number), 0);

  const values = new Map<string, number>();
  for (const p of ranked) {
    const v = vorp.get(p.id) as number;
    values.set(p.id, v > 0 && totalPositiveVorp > 0 ? 1 + (v / totalPositiveVorp) * spendable : 1);
  }
  return values;
}

export interface TierResult {
  tier: number;
  basis: "projection" | "adp";
}

// Clusters each position into tiers by looking for statistically unusual
// gaps between consecutive players (gap > mean + 1 stdev of that
// position's gaps), rather than a fixed point/ADP threshold — adapts to
// each position's own scoring shape instead of one magic number for all.
export function assignTiers(players: Player[]): Map<string, TierResult> {
  const result = new Map<string, TierResult>();

  for (const pos of ALL_POSITIONS) {
    const positionPlayers = players.filter((p) => p.position === pos);
    const withProj = positionPlayers.filter((p) => p.projPoints !== null);
    const useProjection = withProj.length >= positionPlayers.filter((p) => p.adp !== null).length * 0.5 && withProj.length >= 3;

    const basis: "projection" | "adp" = useProjection ? "projection" : "adp";
    const ranked = useProjection
      ? [...withProj].sort((a, b) => (b.projPoints as number) - (a.projPoints as number))
      : [...positionPlayers].filter((p) => p.adp !== null).sort((a, b) => (a.adp as number) - (b.adp as number));

    if (ranked.length === 0) continue;

    const values = ranked.map((p) => (useProjection ? (p.projPoints as number) : (p.adp as number)));
    const gaps: number[] = [];
    for (let i = 0; i < values.length - 1; i++) {
      gaps.push(useProjection ? values[i] - values[i + 1] : values[i + 1] - values[i]);
    }
    const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const variance = gaps.length ? gaps.reduce((sum, g) => sum + (g - meanGap) ** 2, 0) / gaps.length : 0;
    const stdevGap = Math.sqrt(variance);
    const breakThreshold = meanGap + stdevGap;

    let tier = 1;
    result.set(ranked[0].id, { tier, basis });
    for (let i = 0; i < gaps.length; i++) {
      if (gaps[i] > breakThreshold && gaps[i] > 0) tier++;
      result.set(ranked[i + 1].id, { tier, basis });
    }
  }

  return result;
}
