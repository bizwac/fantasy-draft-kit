import { db } from "@/lib/db";
import type { Player, PlayerSeasonStats, HuddlePlayerIndexEntry } from "@/lib/types";
import { loadRefreshStatus, saveRefreshStatus } from "@/lib/refreshStatus";

// Cloud-syncs the *shared* player pool separately from cloudSync.ts's
// personal-data backup (drafts, rankings, favorites) — it's an order of
// magnitude bigger and changes on a completely different rhythm.
//
// The `players` table itself gets special treatment here: only the
// handful of fields a CSV import can set (projections, contract year,
// SoS, usage, winning-team signals) are synced, and ONLY a successful
// CSV import ever pushes them — never a routine Sleeper/ADP refresh.
// Every other device only ever *reads* that projection data (merged
// onto its own players by id, never replacing team/position/ADP/injury
// data). This is deliberately narrower than a naive "sync the whole
// table both ways" design: ADP/injuries are regenerated per-device from
// the same public source anyway, so syncing them added a real bug —
// whichever device's routine 24h refresh happened to run (and push)
// last would silently overwrite the cloud's projections with a freshly
// rebuilt player record that had never had projections applied,
// spreading an empty projection set to every device that pulled after.
// seasonStats/huddlePlayers don't have this failure mode (a refresh
// only fills an empty seasonStats table, and huddlePlayers is an
// unrelated index), so they keep the simpler full-table sync.

const STORAGE_KEY = "fade-signal:playerDataCloudSync";

export interface PlayerDataCloudState {
  lastPushedAt: string | null;
  lastPulledAt: string | null;
  lastError: string | null;
}

function loadState(): PlayerDataCloudState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastPushedAt: null, lastPulledAt: null, lastError: null };
    return JSON.parse(raw);
  } catch {
    return { lastPushedAt: null, lastPulledAt: null, lastError: null };
  }
}

function saveState(state: PlayerDataCloudState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getPlayerDataCloudState(): PlayerDataCloudState {
  return loadState();
}

interface TableExport<T> {
  exportedAt: string;
  rows: T[];
}

async function pushTable<T>(table: string, rows: T[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: TableExport<T> = { exportedAt: new Date().toISOString(), rows };
    const res = await fetch(`/api/playerDataSync?table=${table}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function pullTable<T>(table: string): Promise<{ ok: boolean; rows?: T[]; exportedAt?: string; error?: string }> {
  try {
    const res = await fetch(`/api/playerDataSync?table=${table}`, { method: "GET" });
    if (res.status === 404) return { ok: false, error: "No cloud data yet." };
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const json = (await res.json()) as TableExport<T>;
    if (!json || !Array.isArray(json.rows)) return { ok: false, error: "Malformed cloud data." };
    return { ok: true, rows: json.rows, exportedAt: json.exportedAt };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// Only the fields a CSV import can actually set — never adp, team,
// position, injuryStatus, or anything else Sleeper/ADP own.
interface ProjectionFields {
  id: string;
  projPoints: number | null;
  contractYear: boolean | null;
  teamWinningRecordLastYear: boolean | null;
  teamProjectedWinning: boolean | null;
  winningTeam: boolean | null;
  sosSeason: number | null;
  sosPlayoffs: number | null;
  usage: Player["usage"];
}

function extractProjectionFields(p: Player): ProjectionFields {
  return {
    id: p.id,
    projPoints: p.projPoints,
    contractYear: p.contractYear,
    teamWinningRecordLastYear: p.teamWinningRecordLastYear,
    teamProjectedWinning: p.teamProjectedWinning,
    winningTeam: p.winningTeam,
    sosSeason: p.sosSeason,
    sosPlayoffs: p.sosPlayoffs,
    usage: p.usage
  };
}

let isApplyingRemoteData = false;

// Call this once, right after a successful CSV import (see
// ProjectionsImportCard.tsx) — this is the *only* place projection data
// ever gets pushed to the cloud. Only players a CSV actually touched
// are included, so this never overwrites a different device's own
// in-progress import with a wholesale player dump.
export async function pushProjectionFieldsToCloud(): Promise<{ ok: boolean; error?: string }> {
  if (!navigator.onLine) return { ok: false, error: "Offline" };
  const players = await db.players.toArray();
  const rows = players
    .filter(
      (p) =>
        p.projPoints !== null ||
        p.contractYear !== null ||
        p.teamWinningRecordLastYear !== null ||
        p.teamProjectedWinning !== null ||
        p.sosSeason !== null ||
        p.sosPlayoffs !== null ||
        p.usage !== null
    )
    .map(extractProjectionFields);

  const result = await pushTable("players", rows);
  if (!result.ok) {
    saveState({ ...loadState(), lastError: result.error ?? "Push failed" });
    return result;
  }
  saveState({ ...loadState(), lastPushedAt: new Date().toISOString(), lastError: null });
  return { ok: true };
}

// Pulls the cloud's projection fields and merges them onto matching
// local players by id (Sleeper's player IDs are stable/shared across
// devices) — never touches team/position/adp/injury data, so this is
// always safe regardless of how fresh this device's own Sleeper/ADP
// refresh is. A row whose player no longer exists locally is skipped.
export async function pullProjectionFieldsFromCloud(): Promise<{ ok: boolean; matched?: number; error?: string }> {
  if (!navigator.onLine) return { ok: false, error: "Offline" };
  const result = await pullTable<ProjectionFields>("players");
  if (!result.ok) {
    saveState({ ...loadState(), lastError: result.error ?? "Pull failed" });
    return { ok: false, error: result.error };
  }

  const rows = result.rows ?? [];
  const localPlayers = await db.players.bulkGet(rows.map((r) => r.id));
  const updates: Player[] = [];
  rows.forEach((row, i) => {
    const local = localPlayers[i];
    if (!local) return;
    updates.push({
      ...local,
      projPoints: row.projPoints,
      contractYear: row.contractYear,
      teamWinningRecordLastYear: row.teamWinningRecordLastYear,
      teamProjectedWinning: row.teamProjectedWinning,
      winningTeam: row.winningTeam,
      sosSeason: row.sosSeason,
      sosPlayoffs: row.sosPlayoffs,
      usage: row.usage,
      lastUpdated: new Date().toISOString()
    });
  });

  isApplyingRemoteData = true;
  try {
    if (updates.length > 0) await db.players.bulkPut(updates);
  } finally {
    isApplyingRemoteData = false;
  }

  if (result.exportedAt) {
    const status = loadRefreshStatus();
    saveRefreshStatus({ ...status, lastProjectionsImportAt: result.exportedAt });
  }

  saveState({ ...loadState(), lastPulledAt: new Date().toISOString(), lastError: null });
  return { ok: true, matched: updates.length };
}

// Called once at app start (see main.tsx) and by the manual "Restore
// from Cloud" button — merge-only, so it's always safe to just pull
// every time rather than gating on a "is the cloud newer" check.
export async function pullPlayerDataOnOpen(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    await pullProjectionFieldsFromCloud();
  } catch {
    // Best-effort — a device that can't reach the cloud just keeps
    // whatever projections it already has locally.
  }
  await pullSeasonStatsAndHuddleIfNewer();
}

// seasonStats/huddlePlayers keep the simpler full-table replace — a
// refresh only fills an empty seasonStats table (never edits existing
// rows) and huddlePlayers is an unrelated news-link index, so neither
// has the "routine refresh silently overwrites imported data" failure
// mode that players/projections did.
async function pullSeasonStatsAndHuddleIfNewer(): Promise<void> {
  const [seasonStatsRes, huddleRes] = await Promise.all([
    pullTable<PlayerSeasonStats>("seasonStats"),
    pullTable<HuddlePlayerIndexEntry>("huddlePlayers")
  ]);

  isApplyingRemoteData = true;
  try {
    if (seasonStatsRes.ok && (await db.seasonStats.count()) === 0 && (seasonStatsRes.rows?.length ?? 0) > 0) {
      await db.seasonStats.bulkAdd(seasonStatsRes.rows!);
    }
    if (huddleRes.ok && (huddleRes.rows?.length ?? 0) > 0) {
      await db.huddlePlayers.clear();
      await db.huddlePlayers.bulkAdd(huddleRes.rows!);
    }
  } finally {
    isApplyingRemoteData = false;
  }

  const status = loadRefreshStatus();
  saveRefreshStatus({
    ...status,
    lastSeasonStatsRefreshAt: seasonStatsRes.ok ? (seasonStatsRes.exportedAt ?? status.lastSeasonStatsRefreshAt) : status.lastSeasonStatsRefreshAt,
    lastHuddleIndexRefreshAt: huddleRes.ok ? (huddleRes.exportedAt ?? status.lastHuddleIndexRefreshAt) : status.lastHuddleIndexRefreshAt
  });
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 5000;

function scheduleCloudPush(table: string, getRows: () => Promise<unknown[]>): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void getRows().then((rows) => pushTable(table, rows));
  }, DEBOUNCE_MS);
}

let hooksInstalled = false;

// Auto-pushes seasonStats/huddlePlayers on any local write (their own
// refresh) — deliberately does NOT include db.players; that table's
// cloud copy only ever changes via pushProjectionFieldsToCloud, called
// explicitly from a successful CSV import.
export function installPlayerDataCloudSyncHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  db.seasonStats.hook("creating", () => {
    if (!isApplyingRemoteData) scheduleCloudPush("seasonStats", () => db.seasonStats.toArray());
  });
  db.seasonStats.hook("updating", () => {
    if (!isApplyingRemoteData) scheduleCloudPush("seasonStats", () => db.seasonStats.toArray());
  });
  db.huddlePlayers.hook("creating", () => {
    if (!isApplyingRemoteData) scheduleCloudPush("huddlePlayers", () => db.huddlePlayers.toArray());
  });
  db.huddlePlayers.hook("updating", () => {
    if (!isApplyingRemoteData) scheduleCloudPush("huddlePlayers", () => db.huddlePlayers.toArray());
  });
}
