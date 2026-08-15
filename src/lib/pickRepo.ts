import { db } from "./db";
import { locationForOverallPick } from "./draftMath";
import type { Pick } from "./types";

// All board state (on-the-clock, best available, roster tracker) derives
// from `Draft.picks` alone (spec §3.3) — these are the only writes to
// that array, and every one recomputes downstream state for free just by
// being an array mutation the UI re-reads from Dexie's live query.

export async function addPick(draftId: string, playerId: string, teamSlot: number): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    if (draft.picks.some((p) => p.playerId === playerId)) return; // already drafted, no-op

    const loc = locationForOverallPick(draft.picks.length + 1, draft.settings.teams);
    const pick: Pick = {
      overall: loc.overall,
      round: loc.round,
      slotInRound: loc.slotInRound,
      teamSlot,
      playerId,
      timestamp: new Date().toISOString(),
      corrected: false
    };
    await db.drafts.update(draftId, { picks: [...draft.picks, pick] });
  });
}

export async function undoLastPick(draftId: string): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft || draft.picks.length === 0) return;
    await db.drafts.update(draftId, { picks: draft.picks.slice(0, -1) });
  });
}

// Reassign the team or player on a past pick. Renumbering (overall/round/
// slotInRound) is intentionally left alone — those describe the pick
// slot, not what's recorded there — but the pick is flagged `corrected`.
export async function correctPick(
  draftId: string,
  overall: number,
  changes: { teamSlot?: number; playerId?: string }
): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    const picks = draft.picks.map((p) => (p.overall === overall ? { ...p, ...changes, corrected: true } : p));
    await db.drafts.update(draftId, { picks });
  });
}

// Deletes a pick and returns that player to the pool. Picks after it keep
// their own recorded (team, player) — only their *position* shifts down,
// which is fine because position is derived from array order, not stored.
export async function deletePick(draftId: string, overall: number): Promise<void> {
  await db.transaction("rw", db.drafts, async () => {
    const draft = await db.drafts.get(draftId);
    if (!draft) return;
    const remaining = draft.picks.filter((p) => p.overall !== overall);
    const renumbered = remaining.map((p, i) => {
      const loc = locationForOverallPick(i + 1, draft.settings.teams);
      return { ...p, overall: loc.overall, round: loc.round, slotInRound: loc.slotInRound, corrected: true };
    });
    await db.drafts.update(draftId, { picks: renumbered });
  });
}
