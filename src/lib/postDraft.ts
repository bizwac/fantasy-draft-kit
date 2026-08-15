import { buildRosterState, type RosterState } from "./rosterTracker";
import type { Draft, Pick, Player } from "./types";

export interface GridCell {
  pick: Pick | null;
  player: Player | null;
}

export interface PostDraftGrid {
  rounds: number;
  teams: number;
  // grid[roundIndex][teamSlotIndex], both 0-indexed
  grid: GridCell[][];
}

// Each team gets exactly one pick per round — snake order only decides
// *when* in the round they picked, not which round, so the grid is just
// picks placed at [round][teamSlot]. "Partial drafts render what exists"
// (spec §4.23) falls out naturally: rounds/teamSlots with no matching
// pick just stay empty cells.
export function buildPostDraftGrid(draft: Draft, playersById: Map<string, Player>): PostDraftGrid {
  const rounds = Math.max(1, ...draft.picks.map((p) => p.round), 1);
  const teams = draft.settings.teams;
  const grid: GridCell[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teams }, () => ({ pick: null, player: null }))
  );
  for (const pick of draft.picks) {
    const r = pick.round - 1;
    const t = pick.teamSlot - 1;
    if (r < 0 || r >= rounds || t < 0 || t >= teams) continue;
    grid[r][t] = { pick, player: playersById.get(pick.playerId) ?? null };
  }
  return { rounds, teams, grid };
}

export interface TeamProjection {
  teamSlot: number;
  teamName: string;
  starterPoints: number;
  byPosition: Record<string, number>;
  roster: RosterState;
}

const STARTER_CATEGORIES = new Set(["QB", "RB", "WR", "TE", "K", "DST", "FLEX", "SUPERFLEX"]);

// Sum of each team's *starter* projections only (bench doesn't score) —
// requires projections to be imported; returns null if none exist so the
// caller can fall back to reaches/steals (spec §4.24 edge case).
export function computeTeamProjections(draft: Draft, playersById: Map<string, Player>): TeamProjection[] | null {
  const anyProjections = draft.picks.some((p) => playersById.get(p.playerId)?.projPoints !== null);
  if (!anyProjections) return null;

  const results: TeamProjection[] = [];
  for (let teamSlot = 1; teamSlot <= draft.settings.teams; teamSlot++) {
    const teamPicks = draft.picks.filter((p) => p.teamSlot === teamSlot);
    const roster = buildRosterState(teamPicks, playersById, draft.settings.rosterSlots);
    let starterPoints = 0;
    const byPosition: Record<string, number> = {};
    for (const slot of roster.slots) {
      if (!slot.player || !STARTER_CATEGORIES.has(slot.category)) continue;
      const pts = slot.player.projPoints ?? 0;
      starterPoints += pts;
      byPosition[slot.player.position] = (byPosition[slot.player.position] ?? 0) + pts;
    }
    results.push({
      teamSlot,
      teamName: draft.settings.teamNames[teamSlot - 1] ?? `Team ${teamSlot}`,
      starterPoints,
      byPosition,
      roster
    });
  }
  return results.sort((a, b) => b.starterPoints - a.starterPoints);
}

export interface PickValue {
  pick: Pick;
  player: Player;
  teamName: string;
  valueVsAdp: number; // positive = steal (taken later than ADP), negative = reach
}

export interface TeamValueSummary {
  teamSlot: number;
  teamName: string;
  totalValue: number;
  picks: PickValue[];
}

// Fallback for when no projections are imported (spec §4.24): "reaches
// and steals" needs only ADP, which the M2 refresh always populates.
export function computeReachesAndSteals(draft: Draft, playersById: Map<string, Player>): TeamValueSummary[] {
  const byTeam = new Map<number, PickValue[]>();
  for (const pick of draft.picks) {
    const player = playersById.get(pick.playerId);
    if (!player || player.adp === null) continue;
    const value: PickValue = {
      pick,
      player,
      teamName: draft.settings.teamNames[pick.teamSlot - 1] ?? `Team ${pick.teamSlot}`,
      valueVsAdp: player.adp - pick.overall
    };
    const list = byTeam.get(pick.teamSlot) ?? [];
    list.push(value);
    byTeam.set(pick.teamSlot, list);
  }

  const summaries: TeamValueSummary[] = [];
  for (let teamSlot = 1; teamSlot <= draft.settings.teams; teamSlot++) {
    const picks = (byTeam.get(teamSlot) ?? []).sort((a, b) => b.valueVsAdp - a.valueVsAdp);
    summaries.push({
      teamSlot,
      teamName: draft.settings.teamNames[teamSlot - 1] ?? `Team ${teamSlot}`,
      totalValue: picks.reduce((sum, p) => sum + p.valueVsAdp, 0),
      picks
    });
  }
  return summaries.sort((a, b) => b.totalValue - a.totalValue);
}

export function topStealsAndReaches(draft: Draft, playersById: Map<string, Player>, count = 5) {
  const all: PickValue[] = [];
  for (const pick of draft.picks) {
    const player = playersById.get(pick.playerId);
    if (!player || player.adp === null) continue;
    all.push({
      pick,
      player,
      teamName: draft.settings.teamNames[pick.teamSlot - 1] ?? `Team ${pick.teamSlot}`,
      valueVsAdp: player.adp - pick.overall
    });
  }
  const steals = [...all].sort((a, b) => b.valueVsAdp - a.valueVsAdp).slice(0, count);
  const reaches = [...all].sort((a, b) => a.valueVsAdp - b.valueVsAdp).slice(0, count);
  return { steals, reaches };
}
