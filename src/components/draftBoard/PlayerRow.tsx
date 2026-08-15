import type { Player } from "@/lib/types";

const POSITION_COLOR: Record<Player["position"], string> = {
  QB: "var(--info)",
  RB: "var(--success)",
  WR: "var(--accent)",
  TE: "var(--warning)",
  K: "var(--text-secondary)",
  DST: "var(--text-secondary)"
};

export default function PlayerRow({
  player,
  drafted,
  draftedByLabel,
  tier,
  auctionValue,
  favorite,
  doNotDraft,
  onSelect,
  onInfo,
  onToggleFavorite
}: {
  player: Player;
  drafted: boolean;
  draftedByLabel: string | null;
  tier?: number | null;
  auctionValue?: number | null;
  favorite?: boolean;
  doNotDraft?: boolean;
  onSelect: () => void;
  onInfo: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className={[
        "w-full flex items-center min-h-touch border-b border-border transition-colors",
        drafted || doNotDraft ? "opacity-40" : "hover:bg-surface-sunken active:bg-surface-sunken"
      ].join(" ")}
    >
      <button
        type="button"
        disabled={drafted}
        onClick={onSelect}
        className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 min-h-touch text-left overflow-hidden"
      >
        <span
          className="text-xs font-semibold w-8 sm:w-9 shrink-0 text-center rounded px-1 py-0.5"
          style={{ backgroundColor: POSITION_COLOR[player.position], color: "var(--accent-ink)" }}
        >
          {player.position}
        </span>
        <span className={["flex-1 min-w-0 truncate font-medium", drafted ? "line-through" : ""].join(" ")}>
          {player.name}
        </span>
        {doNotDraft && (
          <span className="shrink-0 text-danger" title="Do not draft" aria-label="Do not draft">
            <BanIcon />
          </span>
        )}
        {player.injuryStatus && (
          <span className="text-xs font-semibold text-danger w-6 sm:w-8 shrink-0" title={player.injuryStatus}>
            {player.injuryStatus.slice(0, 1)}
          </span>
        )}
        <span className="text-sm text-text-secondary w-11 sm:w-14 shrink-0 tabular-nums">
          {player.adp !== null ? player.adp.toFixed(1) : "—"}
        </span>
        <span className="text-sm text-text-secondary w-8 sm:w-10 shrink-0 tabular-nums">
          {player.byeWeek ?? "—"}
        </span>
        {player.isRookie && (
          <span className="hidden lg:inline text-xs font-semibold text-info w-5 shrink-0" title="Rookie">
            R
          </span>
        )}
        <span className="hidden lg:inline text-sm text-text-secondary w-12 shrink-0">{player.team}</span>
        {tier != null && (
          <span className="hidden lg:inline text-xs font-medium text-text-secondary w-8 shrink-0 tabular-nums" title={`Tier ${tier}`}>
            T{tier}
          </span>
        )}
        {auctionValue != null && (
          <span className="hidden lg:inline text-sm text-text-secondary w-12 shrink-0 tabular-nums" title="Estimated auction value">
            ${Math.round(auctionValue)}
          </span>
        )}
        {drafted && draftedByLabel && (
          <span className="hidden lg:inline text-xs text-text-secondary w-24 shrink-0 truncate">{draftedByLabel}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onToggleFavorite}
        className={["shrink-0 min-h-touch min-w-touch flex items-center justify-center", favorite ? "text-accent" : "text-text-secondary hover:text-text-primary"].join(" ")}
        aria-label={favorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
        title="Favorite"
      >
        <StarIcon filled={!!favorite} />
      </button>
      <button
        type="button"
        onClick={onInfo}
        className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-text-secondary hover:text-text-primary"
        aria-label={`${player.name} details`}
        title="Player details"
      >
        <InfoIcon />
      </button>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="8" r="1.15" fill="currentColor" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 3.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.7z" strokeLinejoin="round" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 6.5l11 11" strokeLinecap="round" />
    </svg>
  );
}
