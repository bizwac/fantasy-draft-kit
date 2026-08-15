import { useState } from "react";
import type { HTMLAttributes } from "react";
import type { Player, PersonalOverride } from "@/lib/types";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

export default function PersonalPlayerRow({
  player,
  override,
  rank,
  dragHandleProps,
  onToggleFavorite,
  onToggleDoNotDraft,
  onSaveNote,
  onRemoveFromBoard
}: {
  player: Player;
  override: PersonalOverride | undefined;
  rank?: number;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  onToggleFavorite: () => void;
  onToggleDoNotDraft: () => void;
  onSaveNote: (note: string) => void;
  onRemoveFromBoard?: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draftNote, setDraftNote] = useState(override?.note ?? "");

  return (
    <div className="card flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 min-h-touch">
        {dragHandleProps && (
          <button
            type="button"
            className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-text-secondary cursor-grab touch-none"
            aria-label={`Drag to reorder ${player.name}`}
            {...dragHandleProps}
          >
            <DragIcon />
          </button>
        )}
        {rank !== undefined && (
          <span className="text-sm font-semibold text-text-secondary w-6 shrink-0 text-right tabular-nums">{rank}</span>
        )}
        <span
          className="text-xs font-semibold w-9 shrink-0 text-center rounded px-1 py-0.5"
          style={{ backgroundColor: POSITION_COLOR[player.position], color: POSITION_TEXT_COLOR[player.position] }}
        >
          {player.position}
        </span>
        <span className="flex-1 min-w-0 truncate font-medium">{player.name}</span>
        <span className="hidden sm:inline text-sm text-text-secondary w-12 shrink-0">{player.team}</span>
        <span className="text-sm text-text-secondary w-11 shrink-0 tabular-nums" title="ADP">
          {player.adp !== null ? player.adp.toFixed(1) : "—"}
        </span>

        <button
          type="button"
          onClick={onToggleFavorite}
          className={["shrink-0 min-h-touch min-w-touch flex items-center justify-center", override?.favorite ? "text-accent" : "text-text-secondary"].join(" ")}
          aria-label={override?.favorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
          title="Favorite"
        >
          <StarIcon filled={!!override?.favorite} />
        </button>

        <button
          type="button"
          onClick={onToggleDoNotDraft}
          className={["shrink-0 min-h-touch min-w-touch flex items-center justify-center", override?.doNotDraft ? "text-danger" : "text-text-secondary"].join(" ")}
          aria-label={override?.doNotDraft ? `Remove ${player.name} from do-not-draft` : `Mark ${player.name} do-not-draft`}
          title="Do not draft"
        >
          <BanIcon />
        </button>

        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className={["shrink-0 min-h-touch min-w-touch flex items-center justify-center", override?.note ? "text-accent-strong" : "text-text-secondary"].join(" ")}
          aria-label={`Note for ${player.name}`}
          title="Note"
        >
          <NoteIcon filled={!!override?.note} />
        </button>

        {onRemoveFromBoard && (
          <button
            type="button"
            onClick={onRemoveFromBoard}
            className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-text-secondary hover:text-danger"
            aria-label={`Remove ${player.name} from My Board`}
            title="Remove from board"
          >
            ×
          </button>
        )}
      </div>

      {noteOpen && (
        <div className="px-3 pb-3 flex gap-2">
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Add a note…"
            className="flex-1 rounded-md bg-surface-sunken px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            className="btn-secondary text-sm self-end"
            onClick={() => {
              onSaveNote(draftNote);
              setNoteOpen(false);
            }}
          >
            Save
          </button>
        </div>
      )}
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.7z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 6.5l11 11" strokeLinecap="round" />
    </svg>
  );
}

function NoteIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M5 4h14v13l-4 4H5z" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h4" strokeLinecap="round" />
    </svg>
  );
}
