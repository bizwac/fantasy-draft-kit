import { db } from "@/lib/db";
import type { Player, PlayerSeasonStats, HuddlePlayerIndexEntry } from "@/lib/types";
import { loadRefreshStatus, saveRefreshStatus } from "@/lib/refreshStatus";

// Cloud-syncs the *shared* player pool (ADP, injuries, projections,
// season stats, news links) separately from cloudSync.ts's personal-data
// backup (drafts, rankings, favorites) — it's an order of magnitude
// bigger, changes on a completely different rhythm (a refresh/import,
// not every pick), and is bulk-rewritten wholesale rather than
// record-by-record, so folding it into the same debounced push would've
// meant re-uploading several MB on every single draft pick.

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

type TableName = "players" | "seasonStats" | "huddlePlayers";

interface TableExport<T> {
  exportedAt: string;
  rows: T[];
}

async function pushTable<T>(table: TableName, rows: T[]): Promise<{ ok: boolean; error?: string }> {
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

async function pullTable<T>(table: TableName): Promise<{ ok: boolean; rows?: T[]; exportedAt?: string; error?: string }> {
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

// Pushes all three tables. Best-effort per table — e.g. seasonStats
// failing shouldn't stop players from reaching the cloud — but any
// failure is still surfaced so Settings can show it.
export async function pushPlayerDataToCloud(): Promise<{ ok: boolean; error?: string }> {
  if (!navigator.onLine) return { ok: false, error: "Offline" };
  const [players, seasonStats, huddlePlayers] = await Promise.all([
    db.players.toArray(),
    db.seasonStats.toArray(),
    db.huddlePlayers.toArray()
  ]);
  const results = await Promise.all([
    pushTable("players", players),
    pushTable("seasonStats", seasonStats),
    pushTable("huddlePlayers", huddlePlayers)
  ]);
  const failed = results.find((r) => !r.ok);
  if (failed) {
    saveState({ ...loadState(), lastError: failed.error ?? "Push failed" });
    return { ok: false, error: failed.error };
  }
  saveState({ ...loadState(), lastPushedAt: new Date().toISOString(), lastError: null });
  return { ok: true };
}

let isApplyingRemoteData = false;

// Pulls all three tables and replaces the local copies wholesale — the
// same "clear and rebuild" semantics refreshPlayerData already uses for
// `players`, applied consistently to seasonStats/huddlePlayers. Also
// restores the pushing device's refreshStatus (so this device's own 24h
// staleness clock reflects when the data was actually last refreshed,
// not merely when it happened to be pulled) — a table that fails to
// pull just leaves its local copy and staleness clock untouched.
export async function pullPlayerDataFromCloud(): Promise<{ ok: boolean; error?: string }> {
  if (!navigator.onLine) return { ok: false, error: "Offline" };
  const [playersRes, seasonStatsRes, huddleRes] = await Promise.all([
    pullTable<Player>("players"),
    pullTable<PlayerSeasonStats>("seasonStats"),
    pullTable<HuddlePlayerIndexEntry>("huddlePlayers")
  ]);

  if (!playersRes.ok) {
    saveState({ ...loadState(), lastError: playersRes.error ?? "Pull failed" });
    return { ok: false, error: playersRes.error };
  }

  isApplyingRemoteData = true;
  try {
    await db.transaction("rw", db.players, db.seasonStats, db.huddlePlayers, async () => {
      await db.players.clear();
      if (playersRes.rows!.length > 0) await db.players.bulkAdd(playersRes.rows!);
      if (seasonStatsRes.ok) {
        await db.seasonStats.clear();
        if (seasonStatsRes.rows!.length > 0) await db.seasonStats.bulkAdd(seasonStatsRes.rows!);
      }
      if (huddleRes.ok) {
        await db.huddlePlayers.clear();
        if (huddleRes.rows!.length > 0) await db.huddlePlayers.bulkAdd(huddleRes.rows!);
      }
    });
  } finally {
    isApplyingRemoteData = false;
  }

  const at = playersRes.exportedAt ?? new Date().toISOString();
  const status = loadRefreshStatus();
  saveRefreshStatus({
    ...status,
    sleeper: { ok: true, count: playersRes.rows!.length, error: null, at },
    adp: { ok: true, count: playersRes.rows!.length, error: null, at },
    lastSeasonStatsRefreshAt: seasonStatsRes.ok ? at : status.lastSeasonStatsRefreshAt,
    lastHuddleIndexRefreshAt: huddleRes.ok ? at : status.lastHuddleIndexRefreshAt
  });

  saveState({ ...loadState(), lastPulledAt: new Date().toISOString(), lastError: null });
  return { ok: true };
}

// Called once at app start (see main.tsx) — "any device that's opened
// should try to refresh its player data from the cloud." Only actually
// pulls if the cloud copy is newer than what this device last pushed
// (or this device has no player data at all), so opening the app on a
// device that just refreshed moments ago doesn't get clobbered by a
// slightly older cloud snapshot mid-race.
export async function pullPlayerDataIfCloudIsNewer(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const localCount = await db.players.count();
    if (localCount === 0) {
      await pullPlayerDataFromCloud();
      return;
    }
    const res = await fetch("/api/playerDataSync?table=players", { method: "GET" });
    if (!res.ok) return;
    const json = (await res.json()) as { exportedAt?: string };
    if (!json?.exportedAt) return;
    const localPushedAt = loadState().lastPushedAt;
    if (!localPushedAt || new Date(json.exportedAt).getTime() > new Date(localPushedAt).getTime()) {
      await pullPlayerDataFromCloud();
    }
  } catch {
    // Best-effort — the existing 24h staleness refresh (autoRefresh.ts)
    // is the fallback if this can't reach the cloud at all.
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 5000;

function scheduleCloudPush(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void pushPlayerDataToCloud();
  }, DEBOUNCE_MS);
}

let hooksInstalled = false;

// Registers a debounced auto-push whenever players/seasonStats/
// huddlePlayers change locally — covers every write path (the 24h ADP
// refresh, season-stats/huddle-index refresh, and a manual CSV
// projections import) without any of those call sites needing to know
// cloud sync exists. Mirrors cloudSync.ts's installCloudSyncHooks for
// drafts/personalRankings, kept as its own separate set of hooks since
// this data changes on a different rhythm and is bulk-rewritten rather
// than edited record by record.
export function installPlayerDataCloudSyncHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  for (const table of [db.players, db.seasonStats, db.huddlePlayers]) {
    table.hook("creating", () => {
      if (!isApplyingRemoteData) scheduleCloudPush();
    });
    table.hook("updating", () => {
      if (!isApplyingRemoteData) scheduleCloudPush();
    });
    table.hook("deleting", () => {
      if (!isApplyingRemoteData) scheduleCloudPush();
    });
  }
}
