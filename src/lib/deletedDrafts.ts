// A deletion doesn't reach the cloud until its push completes (and the
// Dexie-hook-triggered push for a delete is debounced 3s same as any
// other write) — in that window, another tab/device polling the cloud
// (Live View's auto-pull) can still see the pre-deletion backup and
// pull it back in. The pick-regression guard in personalRepo.ts's
// protectNewerDrafts doesn't help here: a deleted draft has no local
// record to compare against, so "not found locally" reads as "new from
// another device" rather than "deleted here." This tombstone closes
// that gap — an automatic pull skips any draft ID recorded here,
// regardless of what the cloud snapshot says.
const STORAGE_KEY = "fade-signal:deletedDrafts";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // long enough to outlast any stale copy a rarely-opened tab might still hold

interface Tombstone {
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
