import { db } from "./db";
import { exportPersonalData, importPersonalData, type ImportSummary } from "./personalRepo";

// Cloud sync is purely additive on top of the local-first design — the
// draft board and everything else only ever reads/writes IndexedDB
// directly (see src/lib/pickRepo.ts, personalRepo.ts). Nothing here is
// ever on the path of a draft-day interaction; it's all best-effort
// background push plus an explicit pull, so the app keeps working with
// zero network exactly as before this existed.

const STORAGE_KEY = "fade-signal:cloudSync";
const DEBOUNCE_MS = 3000;

export type SyncStatus = "idle" | "syncing" | "error";

export interface CloudSyncState {
  lastPushedAt: string | null;
  lastPulledAt: string | null;
  lastError: string | null;
}

function loadState(): CloudSyncState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastPushedAt: null, lastPulledAt: null, lastError: null };
    return JSON.parse(raw);
  } catch {
    return { lastPushedAt: null, lastPulledAt: null, lastError: null };
  }
}

function saveState(state: CloudSyncState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("fade-signal:cloud-sync-state", { detail: state }));
}

export function getCloudSyncState(): CloudSyncState {
  return loadState();
}

export async function pushBackupToCloud(): Promise<{ ok: boolean; error?: string }> {
  if (!navigator.onLine) return { ok: false, error: "Offline" };
  try {
    const data = await exportPersonalData();
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const error = body.error ?? `HTTP ${res.status}`;
      saveState({ ...loadState(), lastError: error });
      return { ok: false, error };
    }
    saveState({ ...loadState(), lastPushedAt: new Date().toISOString(), lastError: null });
    return { ok: true };
  } catch (err) {
    const error = (err as Error).message;
    saveState({ ...loadState(), lastError: error });
    return { ok: false, error };
  }
}

// Set for the duration of a pull's local write so installCloudSyncHooks'
// write-triggered push doesn't immediately re-push the data this pull
// just wrote — relevant now that pulls can run on an interval (see
// startAutoPull) instead of only from an explicit user action.
let isApplyingRemoteData = false;

export async function pullBackupFromCloud(): Promise<{ ok: boolean; summary?: ImportSummary; error?: string }> {
  try {
    const res = await fetch("/api/sync", { method: "GET" });
    if (res.status === 404) {
      return { ok: false, error: "No cloud backup yet — push one first." };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const json = await res.json();
    isApplyingRemoteData = true;
    let summary: ImportSummary;
    try {
      summary = await importPersonalData(json);
    } finally {
      isApplyingRemoteData = false;
    }
    if (summary.errors.length > 0) {
      return { ok: false, error: summary.errors.join(" ") };
    }
    saveState({ ...loadState(), lastPulledAt: new Date().toISOString(), lastError: null });
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function isLocalDataEmpty(): Promise<boolean> {
  const [draftCount, overrideCount] = await Promise.all([db.drafts.count(), db.personalRankings.count()]);
  return draftCount === 0 && overrideCount === 0;
}

// Called once at app start. A brand-new device/reinstall has nothing to
// lose, so this is the one case an automatic *pull* is safe — anywhere
// else, pulling could silently clobber picks made on this device, so
// that stays an explicit "Restore from Cloud" action instead.
export async function autoPullIfLocalEmpty(): Promise<void> {
  if (!navigator.onLine) return;
  if (!(await isLocalDataEmpty())) return;
  await pullBackupFromCloud();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCloudPush(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void pushBackupToCloud();
  }, DEBOUNCE_MS);
}

let hooksInstalled = false;

// Registers a debounced auto-push on every drafts/personalRankings
// write, plus the reconnect catch-up push. Call once at app start
// (kept out of db.ts itself to avoid a db.ts -> cloudSync -> personalRepo
// -> db.ts import cycle).
export function installCloudSyncHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  for (const table of [db.drafts, db.personalRankings]) {
    table.hook("creating", () => { if (!isApplyingRemoteData) scheduleCloudPush(); });
    table.hook("updating", () => { if (!isApplyingRemoteData) scheduleCloudPush(); });
    table.hook("deleting", () => { if (!isApplyingRemoteData) scheduleCloudPush(); });
  }

  window.addEventListener("online", () => void pushBackupToCloud());
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

// Used by the presentation view (a separate tab/window/device meant for
// screen-share) to stay current without the viewer touching anything.
// Skips ticks while the tab is hidden or offline — no point pulling into
// a screen no one's looking at, and a fetch would just fail offline
// anyway. Returns a cleanup function so callers can use it directly as a
// useEffect return value.
export function startAutoPull(intervalMs: number): () => void {
  stopAutoPull();
  pollTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!navigator.onLine) return;
    void pullBackupFromCloud();
  }, intervalMs);
  return stopAutoPull;
}

export function stopAutoPull(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
