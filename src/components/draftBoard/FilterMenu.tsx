import { useEffect, useRef, useState } from "react";

export interface FilterOption {
  key: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const PANEL_WIDTH = 224; // w-56

// A single "Filters" button that collapses the row of toggle checkboxes
// (previously always spread across the board's filter bar) into a
// dropdown, so the bar stays usable at narrow widths. The active-count
// badge lets a collapsed state still communicate that filters are on.
export default function FilterMenu({ options }: { options: FilterOption[] }) {
  const [open, setOpen] = useState(false);
  // The button's position in the wrapping toolbar varies a lot by
  // viewport width (it can land near either edge), so a fixed left/right
  // anchor overflows off-screen in some layouts. Measure on open instead
  // of guessing from a breakpoint.
  const [align, setAlign] = useState<"left" | "right">("right");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const activeCount = options.filter((o) => o.checked).length;

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setAlign(rect.right - PANEL_WIDTH < 8 ? "left" : "right");
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary text-sm min-h-touch flex items-center gap-1.5 whitespace-nowrap px-3"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-accent text-accent-ink text-[10px] font-semibold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} role="presentation" />
          <div
            className={[
              "absolute top-full mt-2 z-30 card p-2 flex flex-col gap-0.5 w-56 shadow-raised",
              align === "left" ? "left-0" : "right-0"
            ].join(" ")}
            role="menu"
            aria-label="Filters"
          >
            {options.map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-2 text-sm text-text-secondary min-h-touch px-2 rounded hover:bg-surface-sunken"
              >
                <input className="checkbox" type="checkbox" checked={opt.checked} onChange={(e) => opt.onChange(e.target.checked)} />
                {opt.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
