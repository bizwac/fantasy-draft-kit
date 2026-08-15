import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Player } from "@/lib/types";
import PlayerRow from "./PlayerRow";

const ROW_HEIGHT = 52;

export default function PlayerList({
  players,
  draftedIds,
  draftedByLabel,
  onSelect
}: {
  players: Player[];
  draftedIds: Set<string>;
  draftedByLabel: (playerId: string) => string | null;
  onSelect: (player: Player) => void;
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
                onSelect={() => onSelect(player)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
