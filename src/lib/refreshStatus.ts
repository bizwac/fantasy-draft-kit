import type { SourceOutcome } from "./dataSources/refresh";
import type { ScoringFormat } from "./types";

const STORAGE_KEY = "fade-signal:refreshStatus";

export interface RefreshSettings {
  teams: number;
  scoring: ScoringFormat;
  year: number;
}

export interface RefreshStatus {
  sleeper: SourceOutcome | null;
  adp: SourceOutcome | null;
  lastProjectionsImportAt: string | null;
  // Remembered so a manual refresh doesn't reset to defaults between
  // visits, and so the background auto-refresh (see dataSources/
  // autoRefresh.ts) knows what league shape to fetch ADP for without a
  // person there to ask.
  lastUsedSettings: RefreshSettings | null;
}

const EMPTY: RefreshStatus = { sleeper: null, adp: null, lastProjectionsImportAt: null, lastUsedSettings: null };

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
