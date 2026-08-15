import type { SourceOutcome } from "./dataSources/refresh";

const STORAGE_KEY = "fade-signal:refreshStatus";

export interface RefreshStatus {
  sleeper: SourceOutcome | null;
  adp: SourceOutcome | null;
  lastProjectionsImportAt: string | null;
}

const EMPTY: RefreshStatus = { sleeper: null, adp: null, lastProjectionsImportAt: null };

export function loadRefreshStatus(): RefreshStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

export function saveRefreshStatus(status: RefreshStatus): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
}

export function isStale(iso: string | null, maxAgeHours = 48): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > maxAgeHours * 60 * 60 * 1000;
}
