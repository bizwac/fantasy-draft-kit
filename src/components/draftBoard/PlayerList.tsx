import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Player } from "@/lib/types";
import PlayerRow from "./PlayerRow";

const ROW_HEIGHT = 52;

export default function PlayerList({
  players,
  draftedIds,
  draftedByLabel,
  tierFor,
  auctionValueFor,
  favoriteIds,
  doNotDraftIds,
  onSelect,
  onInfo,
  onToggleFavorite
}: {
  players: Player[];
  draftedIds: Set<string>;
  draftedByLabel: (playerId: string) => string | null;
  tierFor?: (playerId: string) => number | null;
  auctionValueFor?: (playerId: string) => number | null;
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

  if (players.length === 0) {
    return (
      <div className="card p-8 text-center text-text-secondary">
        No players match the current filters.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="card overflow-y-auto" style={{ height: "100%" }}>
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
                width: "100%",
                height: row.size,
                transform: `translateY(${row.start}px)`
              }}
            >
              <PlayerRow
                player={player}
                drafted={drafted}
                draftedByLabel={drafted ? draftedByLabel(player.id) : null}
                tier={tierFor?.(player.id) ?? null}
                auctionValue={auctionValueFor?.(player.id) ?? null}
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
  );
}
