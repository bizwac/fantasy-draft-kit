import { COLUMN_DEFS, columnWrapperClass, type ColumnKey } from "./playerListColumns";

// Mirrors PlayerRow's exact structure/widths (padding, gap, column
// widths) so labels line up pixel-for-pixel with the data underneath.
export default function PlayerListHeader({ columns }: { columns: ColumnKey[] }) {
  return (
    <div className="shrink-0 flex items-center min-h-touch border-b border-border bg-surface-raised text-xs font-semibold text-text-secondary">
      <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
        <span className="w-8 sm:w-9 shrink-0 text-center">Pos</span>
        <span className="flex-1 min-w-0">Player</span>
        {columns.map((key) => {
          const def = COLUMN_DEFS[key];
          return (
            <span key={key} className={columnWrapperClass(def)} title={def.title}>
              {def.label}
            </span>
          );
        })}
      </div>
      <span className="shrink-0 min-h-touch min-w-touch" aria-hidden="true" />
      <span className="shrink-0 min-h-touch min-w-touch" aria-hidden="true" />
    </div>
  );
}
