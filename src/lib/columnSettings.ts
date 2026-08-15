import { DEFAULT_COLUMN_ORDER, type ColumnKey } from "@/components/draftBoard/playerListColumns";

const STORAGE_KEY = "fade-signal:columnSettings";

export interface ColumnSettings {
  order: ColumnKey[];
  hidden: ColumnKey[];
}

const DEFAULT: ColumnSettings = { order: DEFAULT_COLUMN_ORDER, hidden: [] };

const VALID_KEYS = new Set<ColumnKey>(DEFAULT_COLUMN_ORDER);

function sanitizeKeys(keys: unknown): ColumnKey[] {
  if (!Array.isArray(keys)) return [];
  return keys.filter((k): k is ColumnKey => VALID_KEYS.has(k as ColumnKey));
}

export function loadColumnSettings(): ColumnSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ColumnSettings>;
    const storedOrder = sanitizeKeys(parsed.order);
    // Any column added to the app after this was saved (or dropped from
    // a corrupted save) still needs a place in the order, so it isn't
    // silently missing from Settings or the table.
    const missing = DEFAULT_COLUMN_ORDER.filter((k) => !storedOrder.includes(k));
    return { order: [...storedOrder, ...missing], hidden: sanitizeKeys(parsed.hidden) };
  } catch {
    return DEFAULT;
  }
}

export function saveColumnSettings(settings: ColumnSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function visibleOrderedColumns(settings: ColumnSettings): ColumnKey[] {
  return settings.order.filter((k) => !settings.hidden.includes(k));
}
