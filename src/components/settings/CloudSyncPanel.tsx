import { useEffect, useState } from "react";
import { getCloudSyncState, pullBackupFromCloud, pushBackupToCloud, type CloudSyncState } from "@/lib/cloudSync";
import {
  getPlayerDataCloudState,
  pullProjectionFieldsFromCloud,
  pushProjectionFieldsToCloud,
  type PlayerDataCloudState
} from "@/lib/dataSources/playerDataCloudSync";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function CloudSyncPanel() {
  const online = useOnlineStatus();
  const [state, setState] = useState<CloudSyncState>(() => getCloudSyncState());
  const [busy, setBusy] = useState<"push" | "pull" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [playerDataState, setPlayerDataState] = useState<PlayerDataCloudState>(() => getPlayerDataCloudState());
  const [playerDataBusy, setPlayerDataBusy] = useState<"push" | "pull" | null>(null);
  const [playerDataMessage, setPlayerDataMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setState((e as CustomEvent<CloudSyncState>).detail);
    window.addEventListener("fade-signal:cloud-sync-state", handler);
    return () => window.removeEventListener("fade-signal:cloud-sync-state", handler);
  }, []);

  async function handlePush() {
    setBusy("push");
    setMessage(null);
    const result = await pushBackupToCloud();
    setMessage(result.ok ? "Backup pushed." : `Couldn't push: ${result.error}`);
    setBusy(null);
  }

  async function handlePull() {
    if (!confirm("Restore from the cloud backup? This adds/updates drafts and personal-board data from the last push — it won't delete anything local-only.")) {
      return;
    }
    setBusy("pull");
    setMessage(null);
    const result = await pullBackupFromCloud();
    setMessage(
      result.ok
        ? `Restored ${result.summary?.merged ?? 0} record(s), ${result.summary?.draftsRestored ?? 0} draft(s).`
        : `Couldn't restore: ${result.error}`
    );
    setBusy(null);
  }

  async function handlePlayerDataPush() {
    setPlayerDataBusy("push");
    setPlayerDataMessage(null);
    const result = await pushProjectionFieldsToCloud();
    setPlayerDataMessage(result.ok ? "Projections pushed." : `Couldn't push: ${result.error}`);
    setPlayerDataState(getPlayerDataCloudState());
    setPlayerDataBusy(null);
  }

  async function handlePlayerDataPull() {
    setPlayerDataBusy("pull");
    setPlayerDataMessage(null);
    const result = await pullProjectionFieldsFromCloud();
    setPlayerDataMessage(
      result.ok ? `Merged projections onto ${result.matched ?? 0} player(s).` : `Couldn't restore: ${result.error}`
    );
    setPlayerDataState(getPlayerDataCloudState());
    setPlayerDataBusy(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">
            Drafts &amp; personal rankings{" "}
            <span className="text-text-secondary font-normal">
              · {online ? `last pushed ${timeAgo(state.lastPushedAt)}` : "offline — will sync when reconnected"}
            </span>
          </span>
          {message && <span className="text-xs text-text-secondary">{message}</span>}
          {state.lastError && !message && <span className="text-xs text-danger">Last error: {state.lastError}</span>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={handlePush} disabled={busy !== null || !online}>
            {busy === "push" ? "Pushing…" : "Sync Now"}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={handlePull} disabled={busy !== null || !online}>
            {busy === "pull" ? "Restoring…" : "Restore from Cloud"}
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">
            CSV-imported projections{" "}
            <span className="text-text-secondary font-normal">
              ·{" "}
              {online ? `last pushed ${timeAgo(playerDataState.lastPushedAt)}` : "offline — will sync when reconnected"}
            </span>
          </span>
          <span className="text-xs text-text-secondary">
            Pushed automatically after a CSV import — this only pulls it back down; ADP/injuries/season stats/news
            stay per-device and refresh on their own.
          </span>
          {playerDataMessage && <span className="text-xs text-text-secondary">{playerDataMessage}</span>}
          {playerDataState.lastError && !playerDataMessage && (
            <span className="text-xs text-danger">Last error: {playerDataState.lastError}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={handlePlayerDataPush}
            disabled={playerDataBusy !== null || !online}
          >
            {playerDataBusy === "push" ? "Pushing…" : "Sync Now"}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={handlePlayerDataPull}
            disabled={playerDataBusy !== null || !online}
          >
            {playerDataBusy === "pull" ? "Restoring…" : "Pull from Cloud"}
          </button>
        </div>
      </div>
    </div>
  );
}
