import type { Pick, Player } from "@/lib/types";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

export default function DraftLogPanel({
  picks,
  teamNames,
  playerFor,
  onUndoLast,
  onReassignTeam,
  onDeletePick,
  onClose
}: {
  picks: Pick[];
  teamNames: string[];
  playerFor: (playerId: string) => Player | undefined;
  onUndoLast: () => void;
  onReassignTeam: (overall: number, teamSlot: number) => void;
  onDeletePick: (overall: number) => void;
  onClose: () => void;
}) {
  const reversed = [...picks].reverse();

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={onClose} role="presentation">
      <div
        className="card h-full w-full sm:w-[420px] rounded-none sm:rounded-l-lg p-5 flex flex-col gap-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Draft log"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Draft Log</h2>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <button
          type="button"
          className="btn-secondary self-start"
          onClick={onUndoLast}
          disabled={picks.length === 0}
        >
          Undo Last Pick
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {reversed.length === 0 && <p className="text-text-secondary text-sm">No picks yet.</p>}
          {reversed.map((pick) => {
            const player = playerFor(pick.playerId);
            return (
            <div key={pick.overall} className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2">
              <span className="text-xs text-text-secondary w-14 shrink-0 tabular-nums">
                {pick.round}.{String(pick.slotInRound).padStart(2, "0")}
              </span>
              {player && (
                <span
                  className="text-xs font-semibold w-7 shrink-0 text-center rounded px-1 py-0.5"
                  style={{ backgroundColor: POSITION_COLOR[player.position], color: POSITION_TEXT_COLOR[player.position] }}
                >
                  {player.position}
                </span>
              )}
              <span className="flex-1 min-w-0 truncate text-sm font-medium">{player?.name ?? "Unknown player"}</span>
              <select
                className="rounded bg-surface-raised text-xs px-1.5 py-1 min-h-touch max-w-[9rem]"
                value={pick.teamSlot}
                onChange={(e) => onReassignTeam(pick.overall, Number(e.target.value))}
              >
                {teamNames.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              {pick.corrected && (
                <span className="text-xs text-warning" title="Edited after the fact">
                  ✎
                </span>
              )}
              <button
                type="button"
                className="text-xs text-danger px-2 py-1 min-h-touch"
                onClick={() => onDeletePick(pick.overall)}
              >
                Delete
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
