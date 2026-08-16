// A deletion is only known to the device that clicked Delete unless the
// tombstone itself travels through the same sync payload as everything
// else (see personalRepo.ts's exportPersonalData/importPersonalData) —
// otherwise a genuinely different device (a Live View on a separate
// machine, per the app's own multi-device screen-share design) still
// has its own local copy of the "deleted" draft, and since sync only
// ever *adds/updates* drafts (never removes ones simply absent from an
// incoming snapshot), that other device can push its stale local copy
// right back to the cloud — undoing the delete a few seconds after it
// happened, from the deleter's point of view.
const STORAGE_KEY = "fade-signal:deletedDrafts";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // long enough to outlast any stale copy a rarely-opened device might still hold

export interface Tombstone {
  id: string;
  deletedAt: string;
}

function load(): Tombstone[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tombstone[];
    const cutoff = Date.now() - RETENTION_MS;
    return parsed.filter((t) => new Date(t.deletedAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function save(list: Tombstone[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function recordDeletedDraft(id: string): void {
  const list = load();
  list.push({ id, deletedAt: new Date().toISOString() });
  save(list);
}

export function isRecentlyDeleted(id: string): boolean {
  return load().some((t) => t.id === id);
}

// The current (already-pruned) tombstone list, for including in the
// sync payload so every device eventually learns about every deletion.
export function loadTombstones(): Tombstone[] {
  return load();
}

// Folds another device's tombstones into this device's own list —
// keeping the newer deletedAt on a collision, though in practice an id
// is only ever tombstoned once. Called on every import (both the
// guarded auto-pull and the explicit Restore), so a deletion made
// anywhere eventually reaches every device that syncs.
export function mergeTombstones(incoming: Tombstone[]): void {
  if (incoming.length === 0) return;
  const current = load();
  const byId = new Map(current.map((t) => [t.id, t]));
  for (const t of incoming) {
    const existing = byId.get(t.id);
    if (!existing || new Date(t.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      byId.set(t.id, t);
    }
  }
  save([...byId.values()]);
}
