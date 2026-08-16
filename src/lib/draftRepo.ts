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

export async function duplicateDraft(id: string): Promise<Draft | null> {
  const source = await db.drafts.get(id);
  if (!source) return null;
  const copy: Draft = {
    ...source,
    id: newId(),
    name: `${source.name} (copy)`,
    createdAt: new Date().toISOString(),
    picks: [],
    status: "setup",
    timerRunning: false
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
  // Record the tombstone and push immediately (not the debounced 3s
  // push the Dexie "deleting" hook already schedules) — otherwise a
  // Live View tab polling the cloud every 5s can still see the
  // pre-deletion backup and pull the draft right back. See
  // deletedDrafts.ts for the other half of this fix.
  recordDeletedDraft(id);
  void pushBackupToCloud();
}

export async function updateDraftSettings(id: string, settings: DraftSettings): Promise<void> {
  await db.drafts.update(id, { settings });
}

export async function setTimerRunning(id: string, running: boolean): Promise<void> {
  await db.drafts.update(id, { timerRunning: running });
}
