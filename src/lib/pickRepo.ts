import { db } from "./db";
import { locationForOverallPick, rosterSlotCount } from "./draftMath";
import type { Pick, Player, Position, RosterSlots } from "./types";

const DEDICATED_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
const FLEX_ELIGIBLE: Position[] = ["RB", "WR", "TE"];
const SUPERFLEX_ELIGIBLE: Position[] = ["QB", "RB", "WR", "TE"];

// How many of a position a single CPU team is allowed to draft, total
// (starters + bench) — not just its starting requirement. K/DST are
// hard-capped at 1 regardless of settings (a mock team never needs a
// backup kicker). Everything else floors at 2 (a real draft doesn't
// stockpile 4 QBs in a single-QB league) but scales up with the
// position's own starting requirement plus a one-spot bench buffer for
// FLEX/SUPERFLEX-eligible positions, so e.g. a Superflex league's QBs
// or a deep-bench league's RBs aren't clamped down to a number smaller
// than what the league actually needs to start.
function maxDraftableForPosition(position: Position, rosterSlots: RosterSlots): number {
  if (position === "K" || position === "DST") return 1;
  const dedicated = rosterSlots[position] ?? 0;
  const flexBonus = FLEX_ELIGIBLE.includes(position) ? 1 : 0;
  const superflexBonus = SUPERFLEX_ELIGIBLE.includes(position) && (rosterSlots.SUPERFLEX ?? 0) > 0 ? 1 : 0;
  return Math.max(2, dedicated + flexBonus + superflexBonus);
}

function countByPosition(picks: Pick[], playersById: Map<string, Player>): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const pick of picks) {
    const player = playersById.get(pick.playerId);
    if (player) counts[player.position]++;
  }
  return counts;
}

// Weighted-random pick among the top of the ADP board — a real draft
// isn't perfectly ADP-ordered, but a CPU shouldn't reach wildly either.
// Earlier (lower-ADP) candidates get proportionally more weight via a
// harmonic falloff, so the "random element" is a plausible small reach,
// not a coin flip between the top prospect and someone four rounds off.
function pickWithNoise(rankedCandidates: Player[], rng: () => number): Player {
  const pool = rankedCandidates.slice(0, Math.min(4, rankedCandidates.length));
  const weights = pool.map((_, i) => 1 / (i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// The CPU's actual decision, pulled out as a pure function (same
// rationale as the apply* functions above) so it's unit-testable
// without Dexie and reproducible via an injected rng instead of
// Math.random. teamPicks must already be filtered to the drafting
// team's own picks.
export function chooseCpuPick(
  players: Player[],
  draftedIds: Set<string>,
  teamPicks: Pick[],
  rosterSlots: RosterSlots,
  totalRounds: number,
  rng: () => number = Math.random
): Player | null {
  const playersById = new Map(players.map((p) => [p.id, p]));
  const positionCounts = countByPosition(teamPicks, playersById);

  const eligible = (restrictTo?: Position[]) =>
    players
      .filter((p) => p.adp !== null && !draftedIds.has(p.id))
      .filter((p) => !restrictTo || restrictTo.includes(p.position))
      .filter((p) => positionCounts[p.position] < maxDraftableForPosition(p.position, rosterSlots))
      .sort((a, b) => (a.adp as number) - (b.adp as number));

  // This team's remaining picks (including this one) equals the rounds
  // it hasn't yet drafted in — every team gets exactly one pick per
  // round in a snake draft, so this is exact, not an estimate.
  const remainingPicksForTeam = totalRounds - teamPicks.length;
  const stillNeeded = DEDICATED_POSITIONS.filter((pos) => positionCounts[pos] < (rosterSlots[pos] ?? 0));

  // Running out of room to fill starting requirements: force a pick
  // from whatever's still unfilled instead of letting pure ADP leave a
  // team with, say, zero QBs at the end of the draft.
  let candidates = remainingPicksForTeam <= stillNeeded.length && stillNeeded.length > 0 ? eligible(stillNeeded) : eligible();
  if (candidates.length === 0) candidates = eligible(); // needed position has no ADP-ranked players left
  if (candidates.length === 0) {
    // Every remaining position is at its draftable cap (extreme edge
    // case, e.g. a tiny player pool in tests) — better to make a legal
    // pick than stall the draft.
    candidates = players.filter((p) => p.adp !== null && !draftedIds.has(p.id)).sort((a, b) => (a.adp as number) - (b.adp as number));
  }
  if (candidates.length === 0) return null;

  return pickWithNoise(candidates, rng);
}

// All board state (on-the-clock, best available, roster tracker) derives
// from `Draft.picks` alone (spec §3.3) — these are the only writes to
// that array, and every one recomputes downstream state for free just by
// being an array mutation the UI re-reads from Dexie's live query.
//
// The actual array transformations are pure functions (apply*) so the
// highest-risk logic here — correcting/undoing picks without ever
// duplicating a player or losing count reconciliation (spec §8b) — is
// unit-testable without a Dexie/IndexedDB environment. The exported
// async functions are thin persistence wrappers around them.

export function applyAddPick(picks: Pick[], playerId: string, teamSlot: number, teams: number): Pick[] {
  if (picks.some((p) => p.playerId === playerId)) return picks; // already drafted, no-op
  const loc = locationForOverallPick(picks.length + 1, teams);
  const pick: Pick = {
    overall: loc.overall,
    round: loc.round,
    slotInRound: loc.slotInRound,
    teamSlot,
    playerId,
    timestamp: new Date().toISOString(),
    corrected: false
  };
  return [...picks, pick];
}

export function applyUndoLastPick(picks: Pick[]): Pick[] {
  return picks.length === 0 ? picks : picks.slice(0, -1);
}

// Reassign the team or player on a past pick. Renumbering (overall/round/
// slotInRound) is intentionally left alone — those describe the pick
// slot, not what's recorded there — but the pick is flagged `corrected`.
export function applyCorrectPick(picks: Pick[], overall: number, changes: { teamSlot?: number; playerId?: string }): Pick[] {
  return picks.map((p) => (p.overall === overall ? { ...p, ...changes, corrected: true } : p));
}

// Deletes a pick and returns that player to the pool. Picks after it keep
// their own recorded (team, player) — only their *position* shifts down,
// which is fine because position is derived from array order, not stored.
export function applyDeletePick(picks: Pick[], overall: number, teams: number): Pick[] {
  const remaining = picks.filter((p) => p.overall !== overall);
  return remaining.map((p, i) => {
    const loc = locationForOverallPick(i + 1, teams);
    // Only flag picks whose position actually shifted — one before the
    // deleted pick keeps its exact original data and shouldn't show the
    // "corrected" (✎) indicator in the Draft Log.
    if (loc.overall === p.overall) return p;
    return { ...p, overall: loc.overall, round: loc.round, slotInRound: loc.slotInRound, corrected: true };
  });
}

export async function addPick(draftId: string, playerId: string, teamSlot: number): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    await db.drafts.update(draftId, { picks: applyAddPick(draft.picks, playerId, teamSlot, draft.settings.teams) });
  });
}

export async function undoLastPick(draftId: string): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    await db.drafts.update(draftId, { picks: applyUndoLastPick(draft.picks) });
  });
}

export async function correctPick(
  draftId: string,
  overall: number,
  changes: { teamSlot?: number; playerId?: string }
): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    await db.drafts.update(draftId, { picks: applyCorrectPick(draft.picks, overall, changes) });
  });
}

export async function deletePick(draftId: string, overall: number): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    await db.drafts.update(draftId, { picks: applyDeletePick(draft.picks, overall, draft.settings.teams) });
  });
}

// Mock drafts' CPU auto-pick — deliberately computes who's on the clock
// *inside* the same transaction that writes the pick, rather than
// taking a precomputed teamSlot from the caller (unlike addPick, whose
// explicit teamSlot is a deliberate feature — reassigning a pick to any
// team for a real draft entered after the fact). The caller (DraftBoard's
// auto-pick effect) only knows "on the clock" from React state, which
// can go stale between that read and this write actually landing — e.g.
// racing the user's own addPick for their turn right at a round
// boundary. If the outer teamSlot were trusted, a pick could land with
// the correct overall/round/slot (computed fresh here) but the *wrong*
// team attached, corrupting the snake order for everything after it.
// Re-fetching the draft and computing on-the-clock right before the
// write closes that window — Dexie serializes writes to db.drafts, so
// whichever transaction actually runs second sees the other's result.
// Returns whether a pick was made (false if it's the user's turn, the
// draft is over, or no undrafted player has an ADP).
export async function autoPickCpu(draftId: string, players: Player[], myDraftSlot: number): Promise<boolean> {
  return db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return false;
    const totalRounds = rosterSlotCount(draft.settings.rosterSlots);
    if (draft.picks.length >= draft.settings.teams * totalRounds) return false;
    const onClock = locationForOverallPick(draft.picks.length + 1, draft.settings.teams);
    if (onClock.teamSlot === myDraftSlot) return false;
    const draftedIds = new Set(draft.picks.map((p) => p.playerId));
    const teamPicks = draft.picks.filter((p) => p.teamSlot === onClock.teamSlot);
    const best = chooseCpuPick(players, draftedIds, teamPicks, draft.settings.rosterSlots, totalRounds);
    if (!best) return false;
    await db.drafts.update(draftId, { picks: applyAddPick(draft.picks, best.id, onClock.teamSlot, draft.settings.teams) });
    return true;
  });
}
