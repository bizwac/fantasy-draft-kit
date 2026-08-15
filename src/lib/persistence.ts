// iOS Safari can evict local storage after weeks of inactivity between
// setup and draft day (spec §3b.2). Request persistent storage on launch
// so the browser protects it from automatic eviction.
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    const alreadyPersisted = await navigator.storage.persisted?.();
    if (alreadyPersisted) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageEstimateInfo {
  usageMB: number | null;
  quotaMB: number | null;
  persisted: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  if (!navigator.storage?.estimate) {
    return { usageMB: null, quotaMB: null, persisted };
  }
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      usageMB: usage != null ? usage / (1024 * 1024) : null,
      quotaMB: quota != null ? quota / (1024 * 1024) : null,
      persisted
    };
  } catch {
    return { usageMB: null, quotaMB: null, persisted };
  }
}
