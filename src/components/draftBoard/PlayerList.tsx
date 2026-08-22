import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Player } from "@/lib/types";
import type { ColumnKey } from "./playerListColumns";
import PlayerRow from "./PlayerRow";
import PlayerListHeader from "./PlayerListHeader";

// Tall enough to comfortably fit a two-line wrapped name (see PlayerRow's
// line-clamp-2) plus padding, so every row is the same height regardless
// of name length — needed both for react-virtual's fixed-size estimate
// and so touch targets don't shift size row to row.
const ROW_HEIGHT = 60;

export default function PlayerList({
  players,
  draftedIds,
  draftedByLabel,
  columns,
  tierFor,
  auctionValueFor,
  lastSeasonPtsFor,
  favoriteIds,
  doNotDraftIds,
  onSelect,
  onInfo,
  onToggleFavorite
}: {
  players: Player[];
  draftedIds: Set<string>;
  draftedByLabel: (playerId: string) => string | null;
  columns: ColumnKey[];
  tierFor?: (playerId: string) => number | null;
  auctionValueFor?: (playerId: string) => number | null;
  lastSeasonPtsFor?: (playerId: string) => number | null;
  favoriteIds?: Set<string>;
  doNotDraftIds?: Set<string>;
  onSelect: (player: Player) => void;
  onInfo: (player: Player) => void;
  onToggleFavorite: (player: Player) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: players.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  });

  return (
    <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
      {players.length === 0 ? (
        <>
          <PlayerListHeader columns={columns} />
          <div className="flex-1 flex items-center justify-center p-8 text-center text-text-secondary">
            No players match the current filters.
          </div>
        </>
      ) : (
        // One scroll container for both axes: horizontal so Pos/Player can
        // stay sticky-left while stat columns scroll underneath them,
        // vertical for the virtualized row list. The header lives inside
        // it too (sticky top-0) so it scrolls horizontally in lockstep
        // with the rows automatically, instead of needing separate scroll
        // position syncing.
        <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
          <PlayerListHeader columns={columns} />
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const player = players[row.index];
              const drafted = draftedIds.has(player.id);
              return (
                <div
                  key={player.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: row.size,
                    transform: `translateY(${row.start}px)`
                  }}
                >
                  <PlayerRow
                    player={player}
                    drafted={drafted}
                    draftedByLabel={drafted ? draftedByLabel(player.id) : null}
                    columns={columns}
                    tier={tierFor?.(player.id) ?? null}
                    auctionValue={auctionValueFor?.(player.id) ?? null}
                    lastSeasonPts={lastSeasonPtsFor?.(player.id) ?? null}
                    favorite={favoriteIds?.has(player.id) ?? false}
                    doNotDraft={doNotDraftIds?.has(player.id) ?? false}
                    onSelect={() => onSelect(player)}
                    onInfo={() => onInfo(player)}
                    onToggleFavorite={() => onToggleFavorite(player)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
