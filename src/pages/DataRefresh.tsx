import { getStorageEstimate } from "@/lib/persistence";
import { useEffect, useState } from "react";

export default function DataRefresh() {
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof getStorageEstimate>> | null>(null);

  useEffect(() => {
    getStorageEstimate().then(setStorage);
  }, []);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-display">Data Refresh</h1>
      <div className="card p-6 flex flex-col gap-3 text-text-secondary">
        <p>
          The Sleeper / ADP / CSV-import pipeline lands in M2. This screen will show per-source status,
          a refresh button, and a CSV dropzone for projections.
        </p>
        {storage && (
          <p className="text-sm">
            Storage: {storage.usageMB?.toFixed(1) ?? "—"} MB used
            {storage.quotaMB ? ` of ${storage.quotaMB.toFixed(0)} MB` : ""} ·{" "}
            {storage.persisted ? "persisted (protected from eviction)" : "not yet persisted"}
          </p>
        )}
      </div>
    </div>
  );
}
