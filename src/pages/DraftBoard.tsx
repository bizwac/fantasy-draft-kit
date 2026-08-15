import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { locationForOverallPick, nextPickForSlot, rosterSlotCount } from "@/lib/draftMath";
import { addPick, correctPick, deletePick, undoLastPick } from "@/lib/pickRepo";
import type { Player, Position } from "@/lib/types";
import TurnTracker from "@/components/draftBoard/TurnTracker";
import PlayerList from "@/components/draftBoard/PlayerList";
import ConfirmDraftSheet from "@/components/draftBoard/ConfirmDraftSheet";
import DraftLogPanel from "@/components/draftBoard/DraftLogPanel";

const POSITIONS: Array<Position | "ALL"> = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

export default function DraftBoard() {
  const { id } = useParams<{ id: string }>();
  const draft = useLiveQuery(() => (id ? db.drafts.get(id) : undefined), [id]);
  const players = useLiveQuery(() => db.players.toArray(), []);

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [confirmingPlayer, setConfirmingPlayer] = useState<Player | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const draftedIds = useMemo(() => new Set((draft?.picks ?? []).map((p) => p.playerId)), [draft?.picks]);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players ?? []) map.set(p.id, p);
    return map;
  }, [players]);

  const filteredSortedPlayers = useMemo(() => {
    if (!players) return [];
    const query = search.trim().toLowerCase();
    return players
      .filter((p) => (position === "ALL" ? true : p.position === position))
      .filter((p) => (query ? p.name.toLowerCase().includes(query) : true))
      .filter((p) => (hideDrafted ? !draftedIds.has(p.id) : true))
      .sort((a, b) => {
        const aAdp = a.adp ?? Infinity;
        const bAdp = b.adp ?? Infinity;
        if (aAdp !== bAdp) return aAdp - bAdp;
        return a.name.localeCompare(b.name);
      });
  }, [players, search, position, hideDrafted, draftedIds]);

  if (!draft || !players) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  const totalRounds = rosterSlotCount(draft.settings.rosterSlots);
  const onClock = locationForOverallPick(draft.picks.length + 1, draft.settings.teams);
  const isDraftOver = onClock.overall > draft.settings.teams * totalRounds;
  const onClockTeamName = draft.settings.teamNames[onClock.teamSlot - 1] ?? `Team ${onClock.teamSlot}`;
  const isMyTurn = !isDraftOver && onClock.teamSlot === draft.settings.myDraftSlot;
  const myNextOverall = nextPickForSlot(draft.settings.myDraftSlot, draft.settings.teams, totalRounds, draft.picks.length);
  const myNextPick = myNextOverall !== null ? locationForOverallPick(myNextOverall, draft.settings.teams) : null;
  const picksUntilMine = myNextPick ? myNextPick.overall - onClock.overall : null;

  function draftedByLabel(playerId: string): string | null {
    const pick = draft!.picks.find((p) => p.playerId === playerId);
    if (!pick) return null;
    return draft!.settings.teamNames[pick.teamSlot - 1] ?? `Team ${pick.teamSlot}`;
  }

  async function handleConfirm(teamSlot: number) {
    if (!confirmingPlayer || !id) return;
    await addPick(id, confirmingPlayer.id, teamSlot);
    setConfirmingPlayer(null);
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100dvh-2rem)] md:h-[calc(100dvh-4rem)]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-display font-semibold truncate">{draft.name}</h1>
        <button type="button" className="btn-secondary text-sm shrink-0" onClick={() => setLogOpen(true)}>
          Draft Log
        </button>
      </div>

      {isDraftOver ? (
        <div className="card p-6 text-center">Draft complete — every roster spot has been picked.</div>
      ) : (
        <TurnTracker
          onClock={onClock}
          onClockTeamName={onClockTeamName}
          isMyTurn={isMyTurn}
          myNextPick={myNextPick}
          picksUntilMine={picksUntilMine}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch flex-1 min-w-[10rem]"
        />
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPosition(pos)}
            className={[
              "min-h-touch rounded-md px-3 text-sm font-medium transition-colors",
              position === pos ? "bg-accent text-accent-ink" : "bg-surface-sunken text-text-primary"
            ].join(" ")}
          >
            {pos}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={hideDrafted} onChange={(e) => setHideDrafted(e.target.checked)} />
          Hide drafted
        </label>
      </div>

      <div className="flex-1 min-h-0">
        <PlayerList
          players={filteredSortedPlayers}
          draftedIds={draftedIds}
          draftedByLabel={draftedByLabel}
          onSelect={(player) => setConfirmingPlayer(player)}
        />
      </div>

      {confirmingPlayer && (
        <ConfirmDraftSheet
          player={confirmingPlayer}
          teamNames={draft.settings.teamNames}
          defaultTeamSlot={onClock.teamSlot}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmingPlayer(null)}
        />
      )}

      {logOpen && id && (
        <DraftLogPanel
          picks={draft.picks}
          teamNames={draft.settings.teamNames}
          playerName={(playerId) => playersById.get(playerId)?.name ?? "Unknown player"}
          onUndoLast={() => undoLastPick(id)}
          onReassignTeam={(overall, teamSlot) => correctPick(id, overall, { teamSlot })}
          onDeletePick={(overall) => deletePick(id, overall)}
          onClose={() => setLogOpen(false)}
        />
      )}
    </div>
  );
}
