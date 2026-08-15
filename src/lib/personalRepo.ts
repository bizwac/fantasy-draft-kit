import { z } from "zod";
import { db } from "./db";
import type { Draft, PersonalOverride } from "./types";

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

// Full Draft schema, matching types.ts exactly — drafts are the other
// dataset that isn't trivially re-fetchable (a completed draft can't be
// regenerated), so the backup covers them too (v2), not just personal
// rankings (v1). Kept backward-compatible: a v1 file still imports fine,
// it just has no drafts to restore.
const RosterSlotsSchema = z.object({
  QB: z.number(),
  RB: z.number(),
  WR: z.number(),
  TE: z.number(),
  FLEX: z.number(),
  SUPERFLEX: z.number().optional(),
  K: z.number(),
  DST: z.number(),
  BENCH: z.number(),
  IR: z.number().optional()
});
const DraftSettingsSchema = z.object({
  teams: z.number(),
  scoring: z.enum(["ppr", "half", "std", "superflex-ppr"]),
  rosterSlots: RosterSlotsSchema,
  snake: z.literal(true),
  myDraftSlot: z.number(),
  teamNames: z.array(z.string())
});
const PickSchema = z.object({
  overall: z.number(),
  round: z.number(),
  slotInRound: z.number(),
  teamSlot: z.number(),
  playerId: z.string(),
  timestamp: z.string(),
  corrected: z.boolean()
});
const DraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  settings: DraftSettingsSchema,
  picks: z.array(PickSchema),
  status: z.enum(["setup", "live", "complete"])
});

const PersonalDataExportSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  overrides: z.array(PersonalOverrideSchema),
  drafts: z.array(DraftSchema).optional()
});

export interface PersonalDataExport {
  version: 2;
  exportedAt: string;
  overrides: PersonalOverride[];
  drafts: Draft[];
}

export async function exportPersonalData(): Promise<PersonalDataExport> {
  const [overrides, drafts] = await Promise.all([db.personalRankings.toArray(), db.drafts.toArray()]);
  return { version: 2, exportedAt: new Date().toISOString(), overrides, drafts };
}

export interface ImportSummary {
  merged: number;
  draftsRestored: number;
  errors: string[];
}

// Validates against a schema before merging (spec §7b.2) and reconciles
// by playerId rather than blowing away existing entries (spec §3b.3).
// Drafts restore by full overwrite-by-id instead — a draft backup is a
// single authoritative snapshot (unlike personalRankings, which
// accumulates small edits from multiple points), so "restore" means put
// back exactly what was exported, not field-merge with what's there now.
export async function importPersonalData(json: unknown): Promise<ImportSummary> {
  const parsed = PersonalDataExportSchema.safeParse(json);
  if (!parsed.success) {
    return { merged: 0, draftsRestored: 0, errors: ["File isn't a valid Fade Signal personal-data export."] };
  }

  const existing = await db.personalRankings.toArray();
  const byId = new Map(existing.map((o) => [o.playerId, o]));

  for (const incoming of parsed.data.overrides) {
    const current = byId.get(incoming.playerId) ?? emptyOverride(incoming.playerId);
    byId.set(incoming.playerId, mergeOverride(current, incoming));
  }

  await db.personalRankings.bulkPut([...byId.values()]);

  const drafts = parsed.data.drafts ?? [];
  if (drafts.length > 0) {
    await db.drafts.bulkPut(drafts);
  }

  return { merged: parsed.data.overrides.length, draftsRestored: drafts.length, errors: [] };
}
