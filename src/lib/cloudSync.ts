import { db } from "./db";
import { exportPersonalData, importPersonalData, type ImportSummary } from "./personalRepo";

// Cloud sync is purely additive on top of the local-first design — the
// draft board and everything else only ever reads/writes IndexedDB
// directly (see src/lib/pickRepo.ts, personalRepo.ts). Nothing here is
// ever on the path of a draft-day interaction; it's all best-effort
// background push plus an explicit pull, so the app keeps working with
// zero network exactly as before this existed.

const STORAGE_KEY = "fade-signal:cloudSync";
const DEBOUNCE_MS = 300;

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

export async function pullBackupFromCloud(
  options?: { protectNewerDrafts?: boolean }
): Promise<{ ok: boolean; summary?: ImportSummary; error?: string }> {
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
      summary = await importPersonalData(json, options);
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
  // protectNewerDrafts here isn't about pick-count regression (there's
  // nothing local to regress) — it's the tombstone check: deleting your
  // only draft empties local data, and reloading right after (before
  // the delete's push lands) would otherwise resurrect it straight from
  // the stale cloud snapshot.
  await pullBackupFromCloud({ protectNewerDrafts: true });
}

// sendBeacon is handed off to the browser's own network stack the
// instant it's called — unlike a fetch() kicked off from a timer that
// fires later, there's no window between "the write happened" and "the
// request is issued" for the OS to suspend. That gap is exactly what a
// Worker-based debounce (below) still can't close: even a Worker's
// timer still has to *wait out the debounce* before firing, and on iOS
// a backgrounded PWA can apparently stop that pending fetch from ever
// completing during that wait. Fire-and-forget by design (no response,
// so it never updates lastPushedAt/lastError) — it's a low-latency
// head start, not a replacement for the tracked push below.
function pushViaBeacon(data: unknown): void {
  if (typeof navigator.sendBeacon !== "function") return;
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  navigator.sendBeacon("/api/sync", blob);
}

// Construction can fail synchronously (Workers unsupported/disabled) or
// asynchronously (the worker script itself fails to load/parse — e.g. a
// stricter CSP enforcement or a WebKit module-worker quirk on some
// Safari versions) — either way this must never throw or leave the app
// unable to render, so every caller treats a null return (now or later,
// via onWorkerError) as "fall back to a plain page timer" rather than a
// fatal error.
function tryCreateHeartbeatWorker(onWorkerError: () => void): Worker | null {
  try {
    const worker = new Worker(new URL("../workers/heartbeat.ts", import.meta.url), { type: "module" });
    worker.onerror = () => {
      worker.terminate();
      onWorkerError();
    };
    return worker;
  } catch {
    return null;
  }
}

let debounceWorker: Worker | null = null;
let debounceWorkerUnavailable = false;
let plainDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced via the same Worker technique as startAutoPull, not a plain
// setTimeout — a setTimeout scheduled on the page can get suspended
// outright (not just delayed) the moment a backgrounded/unfocused page
// is throttled, which on iOS Safari can happen within seconds of the
// drafter looking away from the app right after making a pick. A
// Worker's timer keeps running regardless, so the pick actually reaches
// the cloud on schedule instead of sitting queued until the app happens
// to be foregrounded again. This is the source of truth for
// lastPushedAt/lastError (Settings reads it); pushViaBeacon above is
// purely a speed optimization run alongside it. Falls back to a plain
// setTimeout (subject to the throttling this was meant to avoid, but
// still functional) if the Worker can't be created or errors out.
export function scheduleCloudPush(): void {
  void exportPersonalData().then(pushViaBeacon);

  if (!debounceWorker && !debounceWorkerUnavailable) {
    debounceWorker = tryCreateHeartbeatWorker(() => {
      debounceWorker = null;
      debounceWorkerUnavailable = true;
    });
    if (debounceWorker) debounceWorker.onmessage = () => void pushBackupToCloud();
    else debounceWorkerUnavailable = true;
  }

  if (debounceWorker) {
    debounceWorker.postMessage({ type: "debounce", delayMs: DEBOUNCE_MS });
  } else {
    if (plainDebounceTimer) clearTimeout(plainDebounceTimer);
    plainDebounceTimer = setTimeout(() => {
      plainDebounceTimer = null;
      void pushBackupToCloud();
    }, DEBOUNCE_MS);
  }
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

let pollWorker: Worker | null = null;
let pollFallbackTimer: ReturnType<typeof setInterval> | null = null;
let pollVisibilityHandler: (() => void) | null = null;

// Used by the presentation view (a separate tab/window/device meant to
// be left running in a screen share — e.g. Zoom — with no interaction)
// to stay current without the viewer touching anything.
//
// The actual ticking happens in a dedicated Worker (see
// workers/heartbeat.ts), not a plain setInterval on this page: Chrome/
// Safari throttle a background/unfocused *page's* timers, sometimes to
// roughly once a minute, and a screen-shared tab is very often not the
// browser's own focused tab even though it's the thing being watched —
// that's exactly what produced multi-second-to-a-minute-plus gaps
// between a pick landing on one device and this view showing it. A
// dedicated Worker's timer isn't subject to that page-level throttling,
// so the heartbeat keeps arriving on schedule regardless of focus.
// Every fetch/IndexedDB write from each tick still happens here on the
// main thread — the worker only ever posts "it's time," nothing more.
// Returns a cleanup function so callers can use it directly as a
// useEffect return value. `onPulled` fires after each successful pull —
// useState(() => loadX()) initializers only run once on mount, so a
// caller reading localStorage-backed preferences (timer/column
// settings) needs this to notice a value that just arrived from another
// device.
export function startAutoPull(intervalMs: number, onPulled?: () => void): () => void {
  stopAutoPull();

  // Skips a tick if the previous pull hasn't resolved yet, so polling
  // self-paces to the actual round trip instead of piling up
  // overlapping requests when a network hiccup makes one pull take
  // longer than intervalMs — the next tick after that one finishes
  // catches up immediately rather than waiting.
  let pullInFlight = false;
  function tick() {
    if (!navigator.onLine || pullInFlight) return;
    pullInFlight = true;
    void pullBackupFromCloud({ protectNewerDrafts: true })
      .then((result) => {
        if (result.ok) onPulled?.();
      })
      .finally(() => {
        pullInFlight = false;
      });
  }

  tick();
  pollWorker = tryCreateHeartbeatWorker(() => {
    pollWorker = null;
    startPollFallback(tick, intervalMs);
  });
  if (pollWorker) {
    pollWorker.onmessage = tick;
    pollWorker.postMessage({ type: "start", intervalMs });
  } else {
    startPollFallback(tick, intervalMs);
  }

  return stopAutoPull;
}

// Plain setInterval fallback for when the Worker can't be created or
// errors out — still functional, just subject to the background-tab
// timer throttling the Worker exists to avoid. Skips ticks while
// hidden (no point pulling into a screen no one's looking at) but
// pulls immediately on regaining visibility so tabbing back doesn't
// wait out a possibly-throttled interval.
function startPollFallback(tick: () => void, intervalMs: number): void {
  pollFallbackTimer = setInterval(() => {
    if (document.visibilityState === "visible") tick();
  }, intervalMs);
  pollVisibilityHandler = () => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", pollVisibilityHandler);
}

export function stopAutoPull(): void {
  if (pollWorker) {
    pollWorker.postMessage({ type: "stop" });
    pollWorker.terminate();
    pollWorker = null;
  }
  if (pollFallbackTimer) {
    clearInterval(pollFallbackTimer);
    pollFallbackTimer = null;
  }
  if (pollVisibilityHandler) {
    document.removeEventListener("visibilitychange", pollVisibilityHandler);
    pollVisibilityHandler = null;
  }
}
