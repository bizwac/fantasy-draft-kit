import { db } from "./db";
import { locationForOverallPick, rosterSlotCount } from "./draftMath";
import type { Pick, Player } from "./types";

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
    let best: Player | null = null;
    for (const p of players) {
      if (p.adp === null || draftedIds.has(p.id)) continue;
      if (!best || p.adp < (best.adp as number)) best = p;
    }
    if (!best) return false;
    await db.drafts.update(draftId, { picks: applyAddPick(draft.picks, best.id, onClock.teamSlot, draft.settings.teams) });
    return true;
  });
}
