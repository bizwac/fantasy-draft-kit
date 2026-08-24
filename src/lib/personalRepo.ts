import { z } from "zod";
import { db } from "./db";
import type { Draft, PersonalOverride } from "./types";
import { loadTimerSettings, saveTimerSettings, type TimerSettings } from "./timerSettings";
import { loadColumnSettings, saveColumnSettings, type ColumnSettings } from "./columnSettings";
import { DEFAULT_COLUMN_ORDER, type ColumnKey } from "@/components/draftBoard/playerListColumns";
import { isRecentlyDeleted, loadTombstones, mergeTombstones, type Tombstone } from "./deletedDrafts";

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
  status: z.enum(["setup", "live", "complete"]),
  timerRunning: z.boolean().optional(),
  isMock: z.boolean().optional()
});

// Timer/column preferences live in localStorage, not Dexie (see
// timerSettings.ts, columnSettings.ts) — plain per-device state until
// now. Folding them into the same backup that already syncs drafts
// means turning the pick timer on for a live draft actually reaches a
// Live View opened on a different device/browser, instead of needing
// to be set separately on every screen. Derived from
// DEFAULT_COLUMN_ORDER (playerListColumns.ts's own list of every
// ColumnKey) instead of a hand-duplicated literal list — a column added
// there previously had no way to reach this schema, so any export
// containing it (i.e. any export at all, since new columns show up in
// the default order/hidden arrays immediately) failed validation
// entirely on import with "isn't a valid ... export", not just a
// missing-column warning.
const ColumnKeySchema = z.enum(DEFAULT_COLUMN_ORDER as [ColumnKey, ...ColumnKey[]]);
const TimerSettingsSchema = z.object({
  enabled: z.boolean(),
  durationSeconds: z.number(),
  soundEnabled: z.boolean()
});
const ColumnSettingsSchema = z.object({
  order: z.array(ColumnKeySchema),
  hidden: z.array(ColumnKeySchema)
});
const PreferencesSchema = z
  .object({
    timerSettings: TimerSettingsSchema.optional(),
    columnSettings: ColumnSettingsSchema.optional()
  })
  .optional();

const TombstoneSchema = z.object({ id: z.string(), deletedAt: z.string() });

const PersonalDataExportSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  overrides: z.array(PersonalOverrideSchema),
  drafts: z.array(DraftSchema).optional(),
  preferences: PreferencesSchema,
  // Deletions only reach other devices if the tombstone itself is part
  // of the synced payload — see deletedDrafts.ts.
  deletedDrafts: z.array(TombstoneSchema).optional()
});

export interface PersonalDataExport {
  version: 2;
  exportedAt: string;
  overrides: PersonalOverride[];
  drafts: Draft[];
  preferences: { timerSettings: TimerSettings; columnSettings: ColumnSettings };
  deletedDrafts: Tombstone[];
}

export async function exportPersonalData(): Promise<PersonalDataExport> {
  const [overrides, drafts] = await Promise.all([db.personalRankings.toArray(), db.drafts.toArray()]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    overrides,
    drafts,
    preferences: { timerSettings: loadTimerSettings(), columnSettings: loadColumnSettings() },
    deletedDrafts: loadTombstones()
  };
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
//
// `protectNewerDrafts` guards the automatic background pull (see
// cloudSync.ts's startAutoPull) against two real races:
//   1. A pick pushes to the cloud ~3s after it's made (debounced), but
//      the presentation view polls every 5s — if that poll lands in the
//      gap, it fetches a snapshot missing the just-made pick and, on a
//      full overwrite, would erase it from the *shared* local IndexedDB
//      (both tabs read the same origin's storage). Skipping any draft
//      whose incoming pick count would go backwards closes this.
//   2. The same gap applies to a *deleted* draft — its own push is now
//      immediate (see draftRepo.ts's deleteDraft) rather than debounced,
//      but a poll can still land before that push completes and resurrect
//      it from a stale snapshot. The pick-count check alone can't catch
//      this (a deleted draft has no local record to compare against, so
//      "not found locally" looks identical to "new from another
//      device") — the tombstone in deletedDrafts.ts covers it instead.
// Tombstone handling itself isn't gated by protectNewerDrafts, unlike
// the pick-regression check — it runs on every import, including the
// explicit "Restore from Cloud" button. A tombstone means "this was
// deliberately deleted, and that fact has already reached the cloud,"
// which a restore should still honor; it's a different kind of fact
// than "the cloud's pick count happens to be lower," which restore is
// allowed to overwrite. Merging incoming tombstones into this device's
// own list — and deleting any local draft that's tombstoned by either
// side — is what actually lets a deletion reach a *different* device
// (e.g. a Live View running on separate hardware) rather than just
// protecting the one device that clicked Delete.
export async function importPersonalData(
  json: unknown,
  options?: { protectNewerDrafts?: boolean }
): Promise<ImportSummary> {
  const parsed = PersonalDataExportSchema.safeParse(json);
  if (!parsed.success) {
    return { merged: 0, draftsRestored: 0, errors: ["File isn't a valid Fade Signal personal-data export."] };
  }

  mergeTombstones(parsed.data.deletedDrafts ?? []);

  const existing = await db.personalRankings.toArray();
  const byId = new Map(existing.map((o) => [o.playerId, o]));

  for (const incoming of parsed.data.overrides) {
    const current = byId.get(incoming.playerId) ?? emptyOverride(incoming.playerId);
    byId.set(incoming.playerId, mergeOverride(current, incoming));
  }

  await db.personalRankings.bulkPut([...byId.values()]);

  let drafts = (parsed.data.drafts ?? []).filter((d) => !isRecentlyDeleted(d.id));
  if (options?.protectNewerDrafts && drafts.length > 0) {
    const existingDrafts = await db.drafts.bulkGet(drafts.map((d) => d.id));
    drafts = drafts.filter((incoming, i) => {
      const local = existingDrafts[i];
      return !local || incoming.picks.length >= local.picks.length;
    });
  }
  if (drafts.length > 0) {
    await db.drafts.bulkPut(drafts);
  }

  const localDraftIds = await db.drafts.toCollection().primaryKeys();
  const tombstonedLocalIds = localDraftIds.filter((id) => isRecentlyDeleted(id as string));
  if (tombstonedLocalIds.length > 0) {
    await db.drafts.bulkDelete(tombstonedLocalIds);
  }

  if (parsed.data.preferences?.timerSettings) saveTimerSettings(parsed.data.preferences.timerSettings);
  if (parsed.data.preferences?.columnSettings) saveColumnSettings(parsed.data.preferences.columnSettings);

  return { merged: parsed.data.overrides.length, draftsRestored: drafts.length, errors: [] };
}
