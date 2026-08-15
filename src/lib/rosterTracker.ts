import type { Pick, Player, Position, RosterSlots } from "./types";

const FLEX_ELIGIBLE: Position[] = ["RB", "WR", "TE"];
const SUPERFLEX_ELIGIBLE: Position[] = ["QB", "RB", "WR", "TE"];

export type SlotCategory = Position | "FLEX" | "SUPERFLEX" | "BENCH" | "IR";

export interface RosterSlotAssignment {
  category: SlotCategory;
  index: number; // 0-indexed within that category, e.g. RB1/RB2
  player: Player | null; // null = an empty, needed slot
}

export interface RosterState {
  slots: RosterSlotAssignment[];
  overflow: Player[]; // drafted beyond every configured slot (shouldn't normally happen)
  byeStackWarnings: string[];
}

const DEDICATED_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

// Fills dedicated position slots first, then FLEX, then SUPERFLEX, then
// bench, then IR — in draft order — so the tracker reflects what actually
// happened rather than some optimal reshuffling. Re-run on every pick /
// correction since it only takes picks.length-derived state as input,
// never stores anything itself (spec §4.7: "corrections must re-derive
// the roster").
export function buildRosterState(myPicks: Pick[], playersById: Map<string, Player>, rosterSlots: RosterSlots): RosterState {
  const capacity: Record<SlotCategory, number> = {
    QB: rosterSlots.QB,
    RB: rosterSlots.RB,
    WR: rosterSlots.WR,
    TE: rosterSlots.TE,
    K: rosterSlots.K,
    DST: rosterSlots.DST,
    FLEX: rosterSlots.FLEX ?? 0,
    SUPERFLEX: rosterSlots.SUPERFLEX ?? 0,
    BENCH: rosterSlots.BENCH,
    IR: rosterSlots.IR ?? 0
  };

  const filled: Record<SlotCategory, Player[]> = {
    QB: [], RB: [], WR: [], TE: [], K: [], DST: [], FLEX: [], SUPERFLEX: [], BENCH: [], IR: []
  };
  const overflow: Player[] = [];

  const ordered = [...myPicks].sort((a, b) => a.overall - b.overall);
  for (const pick of ordered) {
    const player = playersById.get(pick.playerId);
    if (!player) continue;

    if (filled[player.position].length < capacity[player.position]) {
      filled[player.position].push(player);
    } else if (FLEX_ELIGIBLE.includes(player.position) && filled.FLEX.length < capacity.FLEX) {
      filled.FLEX.push(player);
    } else if (SUPERFLEX_ELIGIBLE.includes(player.position) && filled.SUPERFLEX.length < capacity.SUPERFLEX) {
      filled.SUPERFLEX.push(player);
    } else if (filled.BENCH.length < capacity.BENCH) {
      filled.BENCH.push(player);
    } else if (filled.IR.length < capacity.IR) {
      filled.IR.push(player);
    } else {
      overflow.push(player);
    }
  }

  const slots: RosterSlotAssignment[] = [];
  const categories: SlotCategory[] = [...DEDICATED_POSITIONS, "FLEX", "SUPERFLEX", "BENCH", "IR"];
  for (const category of categories) {
    for (let i = 0; i < capacity[category]; i++) {
      slots.push({ category, index: i, player: filled[category][i] ?? null });
    }
  }

  return { slots, overflow, byeStackWarnings: byeStackWarnings(slots) };
}

// Flags bye-week stacking among STARTERS only (dedicated + FLEX +
// SUPERFLEX) — bench bye conflicts don't affect a given week's lineup.
function byeStackWarnings(slots: RosterSlotAssignment[]): string[] {
  const starterCategories: SlotCategory[] = [...DEDICATED_POSITIONS, "FLEX", "SUPERFLEX"];
  const starters = slots.filter((s) => starterCategories.includes(s.category) && s.player?.byeWeek != null);

  const warnings: string[] = [];

  const byWeek = new Map<number, RosterSlotAssignment[]>();
  for (const s of starters) {
    const week = s.player!.byeWeek!;
    const list = byWeek.get(week) ?? [];
    list.push(s);
    byWeek.set(week, list);
  }
  for (const [week, group] of byWeek) {
    if (group.length >= 3) {
      warnings.push(`${group.length} starters share bye week ${week}: ${group.map((g) => g.player!.name).join(", ")}`);
    }
  }

  for (const pos of DEDICATED_POSITIONS) {
    const posStarters = starters.filter((s) => s.category === pos);
    if (posStarters.length >= 2) {
      const weeks = new Set(posStarters.map((s) => s.player!.byeWeek));
      if (weeks.size === 1) {
        warnings.push(`All starting ${pos}s share bye week ${posStarters[0].player!.byeWeek}`);
      }
    }
  }

  return warnings;
}
