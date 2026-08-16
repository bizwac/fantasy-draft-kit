import { useState } from "react";
import { loadTimerSettings, saveTimerSettings } from "@/lib/timerSettings";
import { loadColumnSettings, saveColumnSettings, type ColumnSettings } from "@/lib/columnSettings";
import { COLUMN_DEFS, type ColumnKey } from "@/components/draftBoard/playerListColumns";
import { scheduleCloudPush } from "@/lib/cloudSync";
import RankedList from "@/components/shared/RankedList";

export default function Settings() {
  const [timerSettings, setTimerSettings] = useState(() => loadTimerSettings());
  const [columnSettings, setColumnSettings] = useState(() => loadColumnSettings());

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

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-24">
      <h1 className="text-2xl font-display">Settings</h1>

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
