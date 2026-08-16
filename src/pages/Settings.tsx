import { useEffect, useState } from "react";
import { loadTimerSettings, saveTimerSettings } from "@/lib/timerSettings";
import { loadColumnSettings, saveColumnSettings, type ColumnSettings } from "@/lib/columnSettings";
import { COLUMN_DEFS, type ColumnKey } from "@/components/draftBoard/playerListColumns";
import { scheduleCloudPush } from "@/lib/cloudSync";
import { getStorageEstimate } from "@/lib/persistence";
import { refreshPlayerData, type RefreshResult } from "@/lib/dataSources/refresh";
import { loadRefreshStatus, saveRefreshStatus, isStale, type RefreshStatus } from "@/lib/refreshStatus";
import type { ScoringFormat } from "@/lib/types";
import { db } from "@/lib/db";
import RankedList from "@/components/shared/RankedList";
import CloudSyncPanel from "@/components/settings/CloudSyncPanel";

const TEAM_OPTIONS = [8, 10, 12, 14];
const SCORING_OPTIONS: Array<{ value: ScoringFormat; label: string }> = [
  { value: "ppr", label: "Full PPR" },
  { value: "half", label: "Half PPR" },
  { value: "std", label: "Standard" },
  { value: "superflex-ppr", label: "Superflex" }
];

export default function Settings() {
  const [timerSettings, setTimerSettings] = useState(() => loadTimerSettings());
  const [columnSettings, setColumnSettings] = useState(() => loadColumnSettings());

  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>(() => loadRefreshStatus());
  const [teams, setTeams] = useState(refreshStatus.lastUsedSettings?.teams ?? 12);
  const [scoring, setScoring] = useState<ScoringFormat>(refreshStatus.lastUsedSettings?.scoring ?? "ppr");
  const [year, setYear] = useState(refreshStatus.lastUsedSettings?.year ?? new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<RefreshResult | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof getStorageEstimate>> | null>(null);

  useEffect(() => {
    getStorageEstimate().then(setStorage);
    db.players.count().then(setPlayerCount);
  }, [lastResult]);

  // These live in localStorage, not Dexie, so they don't pass through
  // the write hooks that normally schedule a cloud push (see
  // cloudSync.ts) — trigger one explicitly so a preference set here
  // actually reaches a Live View open on another device.
  function update(next: Partial<typeof timerSettings>) {
    const merged = { ...timerSettings, ...next };
    setTimerSettings(merged);
    saveTimerSettings(merged);
    scheduleCloudPush();
  }

  function updateColumns(next: ColumnSettings) {
    setColumnSettings(next);
    saveColumnSettings(next);
    scheduleCloudPush();
  }

  function toggleColumnVisible(key: ColumnKey, visible: boolean) {
    const hidden = visible ? columnSettings.hidden.filter((k) => k !== key) : [...columnSettings.hidden, key];
    updateColumns({ ...columnSettings, hidden });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const settings = { teams, scoring, year };
      const result = await refreshPlayerData(settings);
      setLastResult(result);
      const next: RefreshStatus = {
        ...refreshStatus,
        sleeper: result.sleeper,
        adp: result.adp,
        lastUsedSettings: settings
      };
      setRefreshStatus(next);
      saveRefreshStatus(next);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-24">
      <h1 className="text-2xl font-display">Settings</h1>

      <section className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display font-semibold">Player Data</h2>
          <p className="text-sm text-text-secondary">
            Pulls player pool, injuries, depth chart, and ADP from Sleeper and Fantasy Football Calculator.
            Automatically refreshes in the background if this data is more than 24 hours old whenever the app is
            open — the button below is for refreshing on demand (e.g. right before a draft) or changing league shape.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Teams</span>
            <select
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
              value={teams}
              onChange={(e) => setTeams(Number(e.target.value))}
            >
              {TEAM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Scoring</span>
            <select
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
              value={scoring}
              onChange={(e) => setScoring(e.target.value as ScoringFormat)}
            >
              {SCORING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-secondary">Season</span>
            <input
              type="number"
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn-primary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh Player Data"}
          </button>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <SourceRow label="Sleeper (players, injuries, depth)" outcome={refreshStatus.sleeper} />
          <SourceRow label="Fantasy Football Calculator (ADP)" outcome={refreshStatus.adp} />
        </div>

        {playerCount !== null && (
          <p className="text-sm text-text-secondary">{playerCount} players in the local dataset.</p>
        )}

        {storage && (
          <p className="text-xs text-text-secondary">
            Storage: {storage.usageMB?.toFixed(1) ?? "—"} MB used
            {storage.quotaMB ? ` of ${storage.quotaMB.toFixed(0)} MB` : ""} ·{" "}
            {storage.persisted ? "persisted (protected from eviction)" : "not yet persisted"}
          </p>
        )}
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display font-semibold">Cloud Backup</h2>
          <p className="text-sm text-text-secondary">
            Drafts, personal rankings, and these preferences back up to the cloud automatically so a Live View on
            another device stays current. Use these for a manual push, or to pull down a backup on a new device.
          </p>
        </div>
        <CloudSyncPanel />
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display font-semibold">Pick Timer</h2>
          <p className="text-sm text-text-secondary">
            An on-the-clock countdown shown on the draft board. It's a visual indicator only — a lapsed timer never
            skips, blocks, or otherwise changes a pick, so it's safe to leave running unattended.
          </p>
        </div>

        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input
            type="checkbox"
            checked={timerSettings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Show pick timer on the draft board
        </label>

        <label className="flex flex-col gap-1.5 w-40">
          <span className="text-sm font-medium text-text-secondary">Seconds per pick</span>
          <input
            type="number"
            min={5}
            max={600}
            step={5}
            className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
            value={timerSettings.durationSeconds}
            disabled={!timerSettings.enabled}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value > 0) update({ durationSeconds: Math.round(value) });
            }}
          />
        </label>

        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input
            type="checkbox"
            checked={timerSettings.soundEnabled}
            disabled={!timerSettings.enabled}
            onChange={(e) => update({ soundEnabled: e.target.checked })}
          />
          Play a sound when time's up
        </label>
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display font-semibold">Table Columns</h2>
          <p className="text-sm text-text-secondary">
            Choose which columns appear on the draft board's player table, and drag to reorder them. Pos and Player
            always lead the row.
          </p>
        </div>

        <RankedList<ColumnKey>
          items={columnSettings.order}
          getId={(key) => key}
          onReorder={(order) => updateColumns({ ...columnSettings, order: order as ColumnKey[] })}
          renderItem={(key, _index, dragHandleProps) => {
            const def = COLUMN_DEFS[key];
            const visible = !columnSettings.hidden.includes(key);
            return (
              <div
                className={[
                  "flex items-center gap-2 rounded-md bg-surface-sunken px-2 py-1.5 min-h-touch",
                  visible ? "" : "opacity-50"
                ].join(" ")}
              >
                <button
                  type="button"
                  className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-text-secondary cursor-grab touch-none"
                  aria-label={`Drag to reorder ${def.settingsLabel}`}
                  {...dragHandleProps}
                >
                  <DragIcon />
                </button>
                <label className="flex-1 flex items-center gap-2 text-sm min-h-touch">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => toggleColumnVisible(key, e.target.checked)}
                  />
                  {def.settingsLabel}
                </label>
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}

function SourceRow({ label, outcome }: { label: string; outcome: RefreshStatus["sleeper"] }) {
  if (!outcome) {
    return (
      <div className="flex items-center justify-between text-text-secondary">
        <span>{label}</span>
        <span>Never refreshed</span>
      </div>
    );
  }
  const stale = isStale(outcome.at);
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {outcome.ok ? (
          <>
            <StatusDot color="var(--success)" />
            <span>
              {outcome.count} loaded · as of {new Date(outcome.at).toLocaleString()}
              {stale && <span className="text-warning"> (stale)</span>}
            </span>
          </>
        ) : (
          <>
            <StatusDot color="var(--danger)" />
            <span className="text-danger">{outcome.error ?? "Failed"}</span>
          </>
        )}
      </span>
    </div>
  );
}

function StatusDot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

function DragIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
