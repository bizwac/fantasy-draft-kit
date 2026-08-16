import type { ReactNode } from "react";
import type { Player } from "@/lib/types";
import { COLUMN_DEFS, columnWrapperClass, type ColumnKey } from "./playerListColumns";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

function renderCell(
  key: ColumnKey,
  ctx: {
    player: Player;
    drafted: boolean;
    draftedByLabel: string | null;
    tier?: number | null;
    auctionValue?: number | null;
    lastSeasonPts?: number | null;
  }
): ReactNode {
  const { player, drafted, draftedByLabel, tier, auctionValue, lastSeasonPts } = ctx;
  // The returned element is used directly as a React list item (see the
  // .map() in PlayerRow below) — it must carry `key` itself. An extra
  // wrapping <span> here would become the actual flex item instead of
  // this width/shrink-classed one, silently breaking alignment with
  // PlayerListHeader's cells.
  const wrapperClass = columnWrapperClass(COLUMN_DEFS[key]);
  switch (key) {
    case "injury":
      return (
        <span key={key} className={`text-xs font-semibold text-danger ${wrapperClass}`} title={player.injuryStatus ?? undefined}>
          {player.injuryStatus?.slice(0, 1) ?? ""}
        </span>
      );
    case "adp":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass} tabular-nums`}>
          {player.adp !== null ? player.adp.toFixed(1) : "—"}
        </span>
      );
    case "rank":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass} tabular-nums`}>
          {player.overallRank ?? "—"}
        </span>
      );
    case "bye":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass} tabular-nums`}>
          {player.byeWeek ?? "—"}
        </span>
      );
    case "rookie":
      return (
        <span key={key} className={`text-xs font-semibold text-info ${wrapperClass}`} title="Rookie">
          {player.isRookie ? "R" : ""}
        </span>
      );
    case "team":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass}`}>
          {player.team}
        </span>
      );
    case "tier":
      return (
        <span
          key={key}
          className={`text-xs font-medium text-text-secondary ${wrapperClass} tabular-nums`}
          title={tier != null ? `Tier ${tier}` : undefined}
        >
          {tier != null ? `T${tier}` : "—"}
        </span>
      );
    case "value":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass} tabular-nums`} title="Estimated auction value">
          {auctionValue != null ? `$${Math.round(auctionValue)}` : "—"}
        </span>
      );
    case "draftedBy":
      return (
        <span key={key} className={`text-xs text-text-secondary ${wrapperClass} truncate`}>
          {drafted && draftedByLabel ? draftedByLabel : ""}
        </span>
      );
    case "lastSeasonPts":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass} tabular-nums`}>
          {lastSeasonPts != null ? lastSeasonPts.toFixed(1) : "—"}
        </span>
      );
    case "projPoints":
      return (
        <span key={key} className={`text-sm text-text-secondary ${wrapperClass} tabular-nums`}>
          {player.projPoints !== null ? player.projPoints.toFixed(1) : "—"}
        </span>
      );
  }
}

export default function PlayerRow({
  player,
  drafted,
  draftedByLabel,
  columns,
  tier,
  auctionValue,
  lastSeasonPts,
  favorite,
  doNotDraft,
  onSelect,
  onInfo,
  onToggleFavorite
}: {
  player: Player;
  drafted: boolean;
  draftedByLabel: string | null;
  columns: ColumnKey[];
  tier?: number | null;
  auctionValue?: number | null;
  lastSeasonPts?: number | null;
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
          style={{ backgroundColor: POSITION_COLOR[player.position], color: POSITION_TEXT_COLOR[player.position] }}
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
        {columns.map((key) => renderCell(key, { player, drafted, draftedByLabel, tier, auctionValue, lastSeasonPts }))}
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
