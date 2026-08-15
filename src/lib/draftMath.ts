import type { RosterSlots } from "./types";

// Snake-order math — the highest-risk logic in the app (spec §8b: "verify
// the on-the-clock team and every 'your next pick' number across all
// rounds, including the reversal at each turn"). Pure functions, no
// state, so board UI can always re-derive from `picks.length` alone.

export function rosterSlotCount(slots: RosterSlots): number {
  return (
    slots.QB +
    slots.RB +
    slots.WR +
    slots.TE +
    slots.FLEX +
    (slots.SUPERFLEX ?? 0) +
    slots.K +
    slots.DST +
    slots.BENCH +
    (slots.IR ?? 0)
  );
}

export interface PickLocation {
  overall: number; // 1-indexed
  round: number; // 1-indexed
  slotInRound: number; // 1-indexed, draft order position within the round
  teamSlot: number; // 1-indexed, reverses on even rounds
}

export function locationForOverallPick(overall: number, teams: number): PickLocation {
  const round = Math.ceil(overall / teams);
  const slotInRound = ((overall - 1) % teams) + 1;
  const teamSlot = round % 2 === 1 ? slotInRound : teams - slotInRound + 1;
  return { overall, round, slotInRound, teamSlot };
}

export function overallPickFor(round: number, teamSlot: number, teams: number): number {
  const slotInRound = round % 2 === 1 ? teamSlot : teams - teamSlot + 1;
  return (round - 1) * teams + slotInRound;
}

// The pick about to happen, given how many picks have already been made.
export function onTheClock(picksMade: number, teams: number): PickLocation {
  return locationForOverallPick(picksMade + 1, teams);
}

// Every overall pick number belonging to `teamSlot` across `totalRounds`.
export function picksForSlot(teamSlot: number, teams: number, totalRounds: number): number[] {
  const picks: number[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    picks.push(overallPickFor(round, teamSlot, teams));
  }
  return picks;
}

// The next upcoming pick (>= the current on-the-clock pick) belonging to
// `teamSlot`, or null if the draft is already past the last round.
export function nextPickForSlot(
  teamSlot: number,
  teams: number,
  totalRounds: number,
  picksMade: number
): number | null {
  const currentOverall = picksMade + 1;
  const all = picksForSlot(teamSlot, teams, totalRounds);
  return all.find((p) => p >= currentOverall) ?? null;
}

export function totalPicks(teams: number, totalRounds: number): number {
  return teams * totalRounds;
}
