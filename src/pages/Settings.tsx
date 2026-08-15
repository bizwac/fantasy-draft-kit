import { useState } from "react";
import { loadTimerSettings, saveTimerSettings } from "@/lib/timerSettings";

export default function Settings() {
  const [timerSettings, setTimerSettings] = useState(() => loadTimerSettings());

  function update(next: Partial<typeof timerSettings>) {
    const merged = { ...timerSettings, ...next };
    setTimerSettings(merged);
    saveTimerSettings(merged);
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
      </section>
    </div>
  );
}
