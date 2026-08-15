import { z } from "zod";
import { db } from "./db";
import type { PersonalOverride } from "./types";

// Personal rankings/notes/favorites/DND are keyed by playerId and shared
// across every draft (spec §3.2) — this is the one dataset that isn't
// trivially re-fetchable, hence the export/import backup below (§3b.3).

function emptyOverride(playerId: string): PersonalOverride {
  return { playerId, customRank: null, favorite: false, doNotDraft: false, note: null };
}

type IncomingOverride = {
  playerId: string;
  customRank?: number | null;
  favorite?: boolean;
  doNotDraft?: boolean;
  note?: string | null;
};

// Pure merge step for import (spec §3b.3: "merge by player ID... don't
// blow away existing entries silently — reconcile"), factored out so it's
// unit-testable without a Dexie/IndexedDB environment.
export function mergeOverride(current: PersonalOverride, incoming: IncomingOverride): PersonalOverride {
  let favorite = incoming.favorite ?? current.favorite;
  let doNotDraft = incoming.doNotDraft ?? current.doNotDraft;
  // Preserve the favorite/do-not-draft mutual exclusivity invariant
  // (spec §4.16) even when a hand-edited or third-party import file sets
  // both — whichever the incoming record explicitly turned on wins,
  // matching toggleFavorite/toggleDoNotDraft's own behavior.
  if (favorite && doNotDraft) {
    if (incoming.favorite === true) doNotDraft = false;
    else if (incoming.doNotDraft === true) favorite = false;
  }
  return {
    playerId: incoming.playerId,
    customRank: incoming.customRank ?? current.customRank,
    favorite,
    doNotDraft,
    note: incoming.note ?? current.note
  };
}

export async function getOverride(playerId: string): Promise<PersonalOverride> {
  return (await db.personalRankings.get(playerId)) ?? emptyOverride(playerId);
}

export async function toggleFavorite(playerId: string): Promise<void> {
  const current = await getOverride(playerId);
  // Favorite and do-not-draft are mutually exclusive (spec §4.16).
  await db.personalRankings.put({ ...current, favorite: !current.favorite, doNotDraft: false });
}

export async function toggleDoNotDraft(playerId: string): Promise<void> {
  const current = await getOverride(playerId);
  await db.personalRankings.put({ ...current, doNotDraft: !current.doNotDraft, favorite: false });
}

export async function setNote(playerId: string, note: string): Promise<void> {
  const current = await getOverride(playerId);
  await db.personalRankings.put({ ...current, note: note.trim() || null });
}

// Appends a player to the bottom of the ranked board (spec §4.18: "new
// players slot in by ADP until manually placed" — this is that manual
// placement action).
export async function addToMyBoard(playerId: string): Promise<void> {
  const all = await db.personalRankings.toArray();
  const maxRank = all.reduce((max, o) => Math.max(max, o.customRank ?? 0), 0);
  const current = await getOverride(playerId);
  await db.personalRankings.put({ ...current, customRank: maxRank + 1 });
}

export async function removeFromMyBoard(playerId: string): Promise<void> {
  const current = await getOverride(playerId);
  await db.personalRankings.put({ ...current, customRank: null });
}

// Persists a full reordering of the ranked list — customRank is always
// rewritten as a dense 1..N sequence so it stays a stable, unambiguous
// sort key regardless of how many times players are added/reordered.
export async function reorderMyBoard(orderedPlayerIds: string[]): Promise<void> {
  const overrides = await Promise.all(orderedPlayerIds.map(getOverride));
  const updated = overrides.map((o, i) => ({ ...o, customRank: i + 1 }));
  await db.personalRankings.bulkPut(updated);
}

const PersonalOverrideSchema = z.object({
  playerId: z.string(),
  customRank: z.number().nullable().optional(),
  favorite: z.boolean().optional(),
  doNotDraft: z.boolean().optional(),
  note: z.string().nullable().optional()
});
const PersonalDataExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  overrides: z.array(PersonalOverrideSchema)
});

export interface PersonalDataExport {
  version: 1;
  exportedAt: string;
  overrides: PersonalOverride[];
}

export async function exportPersonalData(): Promise<PersonalDataExport> {
  const overrides = await db.personalRankings.toArray();
  return { version: 1, exportedAt: new Date().toISOString(), overrides };
}

export interface ImportSummary {
  merged: number;
  errors: string[];
}

// Validates against a schema before merging (spec §7b.2) and reconciles
// by playerId rather than blowing away existing entries (spec §3b.3).
export async function importPersonalData(json: unknown): Promise<ImportSummary> {
  const parsed = PersonalDataExportSchema.safeParse(json);
  if (!parsed.success) {
    return { merged: 0, errors: ["File isn't a valid Fade Signal personal-data export."] };
  }

  const existing = await db.personalRankings.toArray();
  const byId = new Map(existing.map((o) => [o.playerId, o]));

  for (const incoming of parsed.data.overrides) {
    const current = byId.get(incoming.playerId) ?? emptyOverride(incoming.playerId);
    byId.set(incoming.playerId, mergeOverride(current, incoming));
  }

  await db.personalRankings.bulkPut([...byId.values()]);
  return { merged: parsed.data.overrides.length, errors: [] };
}
