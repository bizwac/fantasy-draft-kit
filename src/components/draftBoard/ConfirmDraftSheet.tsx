import { useState } from "react";
import type { Player } from "@/lib/types";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

export default function ConfirmDraftSheet({
  player,
  teamNames,
  defaultTeamSlot,
  onConfirm,
  onCancel
}: {
  player: Player;
  teamNames: string[];
  defaultTeamSlot: number;
  onConfirm: (teamSlot: number) => void;
  onCancel: () => void;
}) {
  const [teamSlot, setTeamSlot] = useState(defaultTeamSlot);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="card w-full sm:max-w-sm p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Confirm draft pick for ${player.name}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-sm font-semibold w-9 h-9 shrink-0 flex items-center justify-center rounded"
            style={{ backgroundColor: POSITION_COLOR[player.position], color: POSITION_TEXT_COLOR[player.position] }}
          >
            {player.position}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-text-secondary uppercase tracking-wide">{player.team}</p>
            <h2 className="font-display text-xl font-semibold truncate">{player.name}</h2>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">Drafted by</span>
          <select
            className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch"
            value={teamSlot}
            onChange={(e) => setTeamSlot(Number(e.target.value))}
            autoFocus
          >
            {teamNames.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(teamSlot)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
