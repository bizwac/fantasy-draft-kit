import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  addToMyBoard,
  exportPersonalData,
  importPersonalData,
  removeFromMyBoard,
  reorderMyBoard,
  setNote,
  toggleDoNotDraft,
  toggleFavorite
} from "@/lib/personalRepo";
import type { Player } from "@/lib/types";
import RankedList from "@/components/shared/RankedList";
import PersonalPlayerRow from "@/components/myBoard/PersonalPlayerRow";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

type Tab = "board" | "favorites" | "dnd";

// Compares directly rather than subtracting (Infinity ?? Infinity) since
// two players both missing ADP would otherwise produce NaN.
function compareByAdp(a: Player, b: Player): number {
  const adpA = a.adp ?? Infinity;
  const adpB = b.adp ?? Infinity;
  if (adpA !== adpB) return adpA - adpB;
  return a.name.localeCompare(b.name);
}

export default function MyBoard() {
  const [tab, setTab] = useState<Tab>("board");
  const [search, setSearch] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const players = useLiveQuery(() => db.players.toArray(), []);
  const overrides = useLiveQuery(() => db.personalRankings.toArray(), []);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players ?? []) map.set(p.id, p);
    return map;
  }, [players]);

  const overridesById = useMemo(() => {
    const map = new Map(overrides?.map((o) => [o.playerId, o]) ?? []);
    return map;
  }, [overrides]);

  const ranked = useMemo(() => {
    return (overrides ?? [])
      .filter((o) => o.customRank !== null)
      .sort((a, b) => (a.customRank as number) - (b.customRank as number))
      .map((o) => playersById.get(o.playerId))
      .filter((p): p is Player => p !== undefined);
  }, [overrides, playersById]);

  const favorites = useMemo(() => {
    return (overrides ?? [])
      .filter((o) => o.favorite)
      .map((o) => playersById.get(o.playerId))
      .filter((p): p is Player => p !== undefined)
      .sort(compareByAdp);
  }, [overrides, playersById]);

  const doNotDraftList = useMemo(() => {
    return (overrides ?? [])
      .filter((o) => o.doNotDraft)
      .map((o) => playersById.get(o.playerId))
      .filter((p): p is Player => p !== undefined)
      .sort(compareByAdp);
  }, [overrides, playersById]);

  const rankedIds = useMemo(() => new Set(ranked.map((p) => p.id)), [ranked]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !players) return [];
    return players
      .filter((p) => !rankedIds.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [search, players, rankedIds]);

  async function handleExport() {
    const data = await exportPersonalData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fade-signal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const json = JSON.parse(await file.text());
      const result = await importPersonalData(json);
      setImportResult(
        result.errors.length > 0
          ? result.errors.join(" ")
          : `Merged ${result.merged} personal record(s)${result.draftsRestored > 0 ? ` and restored ${result.draftsRestored} draft(s)` : ""}.`
      );
    } catch {
      setImportResult("Couldn't read that file as JSON.");
    }
  }

  if (!players || !overrides) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-display">My Board</h1>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={handleExport}>
              Export Backup
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => fileInputRef.current?.click()}>
              Import Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
            />
          </div>
          <p className="text-xs text-text-secondary">Includes favorites/notes/ranks and all drafts</p>
        </div>
      </div>
      {importResult && <p className="text-sm text-text-secondary">{importResult}</p>}

      <div className="flex gap-2">
        {(["board", "favorites", "dnd"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "min-h-touch rounded-md px-4 text-sm font-medium transition-colors",
              tab === t ? "bg-accent text-accent-ink" : "bg-surface-sunken text-text-primary"
            ].join(" ")}
          >
            {t === "board" ? `My Board (${ranked.length})` : t === "favorites" ? `Favorites (${favorites.length})` : `Do Not Draft (${doNotDraftList.length})`}
          </button>
        ))}
      </div>

      {tab === "board" && (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search players to add…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch w-full"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full card max-h-64 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 min-h-touch hover:bg-surface-sunken flex items-center gap-2"
                    onClick={async () => {
                      await addToMyBoard(p.id);
                      setSearch("");
                    }}
                  >
                    <span
                      className="text-xs font-semibold w-8 shrink-0 text-center rounded px-1 py-0.5"
                      style={{ backgroundColor: POSITION_COLOR[p.position], color: POSITION_TEXT_COLOR[p.position] }}
                    >
                      {p.position}
                    </span>
                    <span className="flex-1">{p.name}</span>
                    <span className="text-xs text-text-secondary">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {ranked.length === 0 ? (
            <div className="card p-8 text-center text-text-secondary">
              No players on your board yet — search above to add your first, then drag to reorder.
            </div>
          ) : (
            <RankedList
              items={ranked}
              getId={(p) => p.id}
              onReorder={(orderedIds) => reorderMyBoard(orderedIds)}
              renderItem={(player, rank, dragHandleProps) => (
                <PersonalPlayerRow
                  player={player}
                  override={overridesById.get(player.id)}
                  rank={rank}
                  dragHandleProps={dragHandleProps}
                  onToggleFavorite={() => toggleFavorite(player.id)}
                  onToggleDoNotDraft={() => toggleDoNotDraft(player.id)}
                  onSaveNote={(note) => setNote(player.id, note)}
                  onRemoveFromBoard={() => removeFromMyBoard(player.id)}
                />
              )}
            />
          )}
        </div>
      )}

      {tab === "favorites" && (
        <div className="flex flex-col gap-2">
          {favorites.length === 0 ? (
            <div className="card p-8 text-center text-text-secondary">
              No favorites yet — tap the star on any player to add one.
            </div>
          ) : (
            favorites.map((player) => (
              <PersonalPlayerRow
                key={player.id}
                player={player}
                override={overridesById.get(player.id)}
                onToggleFavorite={() => toggleFavorite(player.id)}
                onToggleDoNotDraft={() => toggleDoNotDraft(player.id)}
                onSaveNote={(note) => setNote(player.id, note)}
              />
            ))
          )}
        </div>
      )}

      {tab === "dnd" && (
        <div className="flex flex-col gap-2">
          {doNotDraftList.length === 0 ? (
            <div className="card p-8 text-center text-text-secondary">No do-not-draft players yet.</div>
          ) : (
            doNotDraftList.map((player) => (
              <PersonalPlayerRow
                key={player.id}
                player={player}
                override={overridesById.get(player.id)}
                onToggleFavorite={() => toggleFavorite(player.id)}
                onToggleDoNotDraft={() => toggleDoNotDraft(player.id)}
                onSaveNote={(note) => setNote(player.id, note)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
