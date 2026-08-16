import { refreshPlayerData } from "./refresh";
import { loadRefreshStatus, saveRefreshStatus, isStale, type RefreshSettings } from "@/lib/refreshStatus";

const STALE_HOURS = 24;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly, for a tab left open across the staleness boundary

const DEFAULT_SETTINGS: RefreshSettings = { teams: 12, scoring: "ppr", year: new Date().getFullYear() };

let running = false;

async function checkAndRefreshIfStale(): Promise<void> {
  if (running) return;
  if (!navigator.onLine) return;
  if (document.visibilityState !== "visible") return;

  const status = loadRefreshStatus();
  // isStale(null) is true, so a fresh install (never refreshed) counts
  // as stale too, not just data that's aged past 24h.
  const stale = isStale(status.sleeper?.at ?? null, STALE_HOURS) || isStale(status.adp?.at ?? null, STALE_HOURS);
  if (!stale) return;

  running = true;
  try {
    const settings = status.lastUsedSettings ?? DEFAULT_SETTINGS;
    const result = await refreshPlayerData(settings);
    saveRefreshStatus({ ...status, sleeper: result.sleeper, adp: result.adp, lastUsedSettings: settings });
  } finally {
    running = false;
  }
}

let checkTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;

// Call once at app start (see main.tsx). Checks immediately, then on an
// hourly timer and whenever the tab regains focus, so "the app is open"
// covers both a fresh load and a tab that's been sitting in the
// background since before the 24h mark passed. Silently skips ticks
// while hidden/offline — same pattern as cloudSync's startAutoPull.
export function startAutoRefreshWatch(): () => void {
  stopAutoRefreshWatch();
  void checkAndRefreshIfStale();
  checkTimer = setInterval(() => void checkAndRefreshIfStale(), CHECK_INTERVAL_MS);
  visibilityHandler = () => void checkAndRefreshIfStale();
  document.addEventListener("visibilitychange", visibilityHandler);
  return stopAutoRefreshWatch;
}

export function stopAutoRefreshWatch(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}
