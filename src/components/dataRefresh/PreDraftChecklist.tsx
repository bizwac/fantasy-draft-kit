import { useState } from "react";

// Spec §8b's manual dry-run checklist, run before each real draft.
// Persisted in localStorage (small UI state, spec §3b.1) purely so it
// doesn't reset every time you leave the screen while working through
// it — it's a personal reminder list, not data worth backing up.
const ITEMS = [
  "Refresh player data; confirm the \"as of\" timestamp is recent (< 2 days)",
  "Confirm draft settings: team count, your slot, scoring, roster slots",
  "Run a 2–3 round mock against the actual board; test one undo and one pick-correction",
  "Verify your favorites / do-not-draft / custom ranks loaded",
  "Put the device in airplane mode and confirm the board still works, then restore"
];

const STORAGE_KEY = "fade-signal:predraft-checklist";

function loadChecked(): boolean[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ITEMS.map(() => false);
    const parsed = JSON.parse(raw);
    return ITEMS.map((_, i) => !!parsed[i]);
  } catch {
    return ITEMS.map(() => false);
  }
}

export default function PreDraftChecklist() {
  const [checked, setChecked] = useState<boolean[]>(loadChecked);
  const doneCount = checked.filter(Boolean).length;

  function toggle(i: number) {
    const next = checked.map((v, idx) => (idx === i ? !v : v));
    setChecked(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <section className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">Pre-Draft Checklist</h2>
        <span className="text-xs text-text-secondary">
          {doneCount}/{ITEMS.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-2.5 text-sm min-h-touch py-1">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 shrink-0"
              />
              <span className={checked[i] ? "text-text-secondary line-through" : ""}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
