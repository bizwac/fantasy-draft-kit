import { COLUMN_DEFS, columnWrapperClass, type ColumnKey } from "./playerListColumns";

// Mirrors PlayerRow's exact structure/widths (padding, gap, column
// widths) so labels line up pixel-for-pixel with the data underneath.
// Sticky on two axes at once: top-0 within the shared scroll container
// (see PlayerList) keeps it pinned while rows scroll past vertically,
// and its own Pos/Player cells are additionally sticky left-0 so they
// stay put during horizontal scroll too — same trick as PlayerRow's,
// just at a higher z-index so the header wins where both stickies
// overlap in the top-left corner.
export default function PlayerListHeader({ columns }: { columns: ColumnKey[] }) {
  return (
    <div className="sticky top-0 z-20 flex items-stretch min-h-touch border-b border-border bg-surface-raised text-xs font-semibold text-text-secondary w-max">
      <span className="sticky left-0 z-20 flex items-center gap-2 sm:gap-3 shrink-0 px-2 sm:px-4 bg-surface-raised">
        <span className="w-8 sm:w-9 shrink-0 text-center">Pos</span>
        <span className="w-28 sm:w-36 shrink-0">Player</span>
      </span>
      <span className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4">
        {columns.map((key) => {
          const def = COLUMN_DEFS[key];
          return (
            <span key={key} className={columnWrapperClass(def)} title={def.title}>
              {def.label}
            </span>
          );
        })}
      </span>
      <span className="shrink-0 min-h-touch min-w-touch" aria-hidden="true" />
      <span className="shrink-0 min-h-touch min-w-touch" aria-hidden="true" />
    </div>
  );
}
