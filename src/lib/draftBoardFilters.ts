import type { Position } from "./types";

// The draft board's search/filter/sort controls, persisted per-draft
// (not per-device-wide, and deliberately not part of cloud sync — this
// is local UI convenience, not data worth losing offline capability
// over or syncing between devices, unlike drafts/personal rankings).
// Keyed by draft id so switching between drafts doesn't leak one
// draft's filters into another's.

export type SortKey = "adp" | "proj" | "vorp" | "value" | "tier" | "myrank";

export interface DraftBoardFilters {
  search: string;
  position: Position | "ALL";
  hideDrafted: boolean;
  hideOutIR: boolean;
  rookiesOnly: boolean;
  winningTeamOnly: boolean;
  favoritesOnly: boolean;
  hideDoNotDraft: boolean;
  sortKey: SortKey;
}

const STORAGE_PREFIX = "fade-signal:draftBoardFilters:";

const DEFAULT: DraftBoardFilters = {
  search: "",
  position: "ALL",
  hideDrafted: false,
  hideOutIR: false,
  rookiesOnly: false,
  winningTeamOnly: false,
  favoritesOnly: false,
  hideDoNotDraft: false,
  sortKey: "adp"
};

export function loadDraftBoardFilters(draftId: string): DraftBoardFilters {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + draftId);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveDraftBoardFilters(draftId: string, filters: DraftBoardFilters): void {
  localStorage.setItem(STORAGE_PREFIX + draftId, JSON.stringify(filters));
}
