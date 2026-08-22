import { db } from "./db";
import { createDefaultDraftSettings, type Draft, type DraftSettings } from "./types";
import { recordDeletedDraft } from "./deletedDrafts";
import { pushBackupToCloud } from "./cloudSync";

function newId(): string {
  return crypto.randomUUID();
}

export async function createDraft(name: string, settings?: Partial<DraftSettings>, isMock = false): Promise<Draft> {
  const draft: Draft = {
    id: newId(),
    name: name.trim() || "Untitled Draft",
    createdAt: new Date().toISOString(),
    settings: { ...createDefaultDraftSettings(), ...settings },
    picks: [],
    status: "setup",
    isMock
  };
  await db.drafts.add(draft);
  return draft;
}

// keepPicks lets a duplicate either clone the picks/status as-is (a
// snapshot to branch from) or, the more common case, carry over just
// the teams/settings and start clean — the caller decides, since only
// it knows whether the source draft actually has picks worth asking
// about. asMock flips the copy into a mock draft (every other team
// auto-picks) while still cloning the real draft's teams/settings —
// implies keepPicks: false, since a mock replaying picks that were
// actually made by real people doesn't make sense.
export async function duplicateDraft(id: string, options?: { keepPicks?: boolean; asMock?: boolean }): Promise<Draft | null> {
  const source = await db.drafts.get(id);
  if (!source) return null;
  const keepPicks = options?.asMock ? false : (options?.keepPicks ?? false);
  const copy: Draft = {
    ...source,
    id: newId(),
    name: `${source.name} (copy)`,
    createdAt: new Date().toISOString(),
    picks: keepPicks ? source.picks : [],
    status: keepPicks ? source.status : "setup",
    timerRunning: false,
    isMock: options?.asMock ? true : source.isMock
  };
  await db.drafts.add(copy);
  return copy;
}

export async function renameDraft(id: string, name: string): Promise<void> {
  await db.drafts.update(id, { name: name.trim() || "Untitled Draft" });
}

export async function deleteDraft(id: string): Promise<void> {
  // Personal rankings are a separate store keyed by playerId — deleting a
  // draft never touches them (spec §4.2).
  await db.drafts.delete(id);
  // Record the tombstone (see deletedDrafts.ts) and push immediately —
  // *awaited*, not fire-and-forget, so the delete isn't considered done
  // until the cloud actually reflects it. A fire-and-forget push left a
  // window where the browser's own local tombstone (localStorage) was
  // the only thing standing between "deleted" and "resurrected by the
  // next pull" — and that tombstone doesn't survive the user clearing
  // site data, which also wipes it. Awaiting the push doesn't fix the
  // offline case (the push still just fails there, same as any other
  // sync action in this app), but it closes the common case where nothing
  // else clears local storage before the push would've landed anyway.
  recordDeletedDraft(id);
  await pushBackupToCloud();
}

export async function updateDraftSettings(id: string, settings: DraftSettings): Promise<void> {
  await db.drafts.update(id, { settings });
}

export async function setTimerRunning(id: string, running: boolean): Promise<void> {
  await db.drafts.update(id, { timerRunning: running });
}
