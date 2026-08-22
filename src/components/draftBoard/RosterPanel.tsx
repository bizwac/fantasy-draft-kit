import type { RosterState } from "@/lib/rosterTracker";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";
import { safeAreaPadding } from "@/lib/safeArea";

const CATEGORY_LABEL: Record<string, string> = {
  QB: "QB", RB: "RB", WR: "WR", TE: "TE", K: "K", DST: "DST",
  FLEX: "FLEX", SUPERFLEX: "SUPERFLEX", BENCH: "Bench", IR: "IR"
};

export default function RosterPanel({ roster, onClose }: { roster: RosterState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={onClose} role="presentation">
      <div
        className="card h-full w-full sm:w-[380px] rounded-none sm:rounded-l-lg flex flex-col gap-4 overflow-hidden"
        style={safeAreaPadding(1.25)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="My roster"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">My Roster</h2>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {roster.byeStackWarnings.length > 0 && (
          <div className="rounded-md bg-surface-sunken border border-warning px-3 py-2 flex flex-col gap-1">
            {roster.byeStackWarnings.map((w, i) => (
              <p key={i} className="text-xs text-warning">
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
          {roster.slots.map((slot, i) => (
            <div
              key={i}
              className={[
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                slot.player ? "bg-surface-sunken" : "bg-surface-sunken/50 border border-dashed border-border"
              ].join(" ")}
            >
              <span className="text-xs font-semibold text-text-secondary w-20 shrink-0">
                {CATEGORY_LABEL[slot.category]} {slot.index + 1}
              </span>
              {slot.player ? (
                <>
                  <span
                    className="text-xs font-semibold w-8 shrink-0 text-center rounded px-1 py-0.5"
                    style={{
                      backgroundColor: POSITION_COLOR[slot.player.position],
                      color: POSITION_TEXT_COLOR[slot.player.position]
                    }}
                  >
                    {slot.player.position}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium">{slot.player.name}</span>
                  <span className="text-xs text-text-secondary">{slot.player.byeWeek ? `Bye ${slot.player.byeWeek}` : ""}</span>
                </>
              ) : (
                <span className="flex-1 text-text-secondary italic">Need</span>
              )}
            </div>
          ))}

          {roster.overflow.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-text-secondary mb-1">Overflow (no slot available)</p>
              {roster.overflow.map((p) => (
                <div key={p.id} className="text-sm px-3 py-1 text-text-secondary">
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
