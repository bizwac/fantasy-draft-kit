import { COL } from "./playerListColumns";

// Mirrors PlayerRow's exact structure/widths (padding, gap, column
// widths) so labels line up pixel-for-pixel with the data underneath.
export default function PlayerListHeader() {
  return (
    <div className="shrink-0 flex items-center min-h-touch border-b border-border bg-surface-raised text-xs font-semibold text-text-secondary">
      <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
        <span className={`${COL.pos} shrink-0 text-center`}>Pos</span>
        <span className="flex-1 min-w-0">Player</span>
        <span className={`${COL.injury} shrink-0`} title="Injury status">
          Inj
        </span>
        <span className={`${COL.adp} shrink-0`}>ADP</span>
        <span className={`${COL.bye} shrink-0`}>Bye</span>
        <span className={`hidden lg:inline ${COL.rookie} shrink-0`} title="Rookie">
          R
        </span>
        <span className={`hidden lg:inline ${COL.team} shrink-0`}>Team</span>
        <span className={`hidden lg:inline ${COL.tier} shrink-0`}>Tier</span>
        <span className={`hidden lg:inline ${COL.value} shrink-0`} title="Estimated auction value">
          $
        </span>
        <span className={`hidden lg:inline ${COL.draftedBy} shrink-0`}>Drafted</span>
      </div>
      <span className="shrink-0 min-h-touch min-w-touch" aria-hidden="true" />
      <span className="shrink-0 min-h-touch min-w-touch" aria-hidden="true" />
    </div>
  );
}
