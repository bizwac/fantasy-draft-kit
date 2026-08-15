import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { locationForOverallPick, nextPickForSlot, rosterSlotCount } from "@/lib/draftMath";
import { addPick, correctPick, deletePick, undoLastPick } from "@/lib/pickRepo";
import { assignTiers, computeAuctionValues, computeVorp, replacementLevels, replacementRanks } from "@/lib/valueMetrics";
import { buildRosterState } from "@/lib/rosterTracker";
import { computeHandcuffs } from "@/lib/handcuff";
import { setNote, toggleDoNotDraft, toggleFavorite } from "@/lib/personalRepo";
import type { Player, Position, RosterSlots } from "@/lib/types";
import TurnTracker from "@/components/draftBoard/TurnTracker";
import PlayerList from "@/components/draftBoard/PlayerList";
import ConfirmDraftSheet from "@/components/draftBoard/ConfirmDraftSheet";
import DraftLogPanel from "@/components/draftBoard/DraftLogPanel";
import ScarcityMeter from "@/components/draftBoard/ScarcityMeter";
import TierAlertBanner from "@/components/draftBoard/TierAlertBanner";
import RosterPanel from "@/components/draftBoard/RosterPanel";
import PlayerDetailCard from "@/components/player/PlayerDetailCard";

const OUT_STATUSES = new Set(["Out", "IR", "PUP", "Suspended"]);

const POSITIONS: Array<Position | "ALL"> = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
const ALL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

type SortKey = "adp" | "proj" | "vorp" | "value" | "tier" | "myrank";
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "adp", label: "ADP" },
  { value: "proj", label: "Projection" },
  { value: "vorp", label: "VORP" },
  { value: "value", label: "$ Value" },
  { value: "tier", label: "Tier" },
  { value: "myrank", label: "My Rank" }
];

function rosterSlotsKey(slots: RosterSlots): string {
  return [slots.QB, slots.RB, slots.WR, slots.TE, slots.FLEX, slots.SUPERFLEX ?? 0, slots.K, slots.DST, slots.BENCH, slots.IR ?? 0].join(
    "|"
  );
}

export default function DraftBoard() {
  const { id } = useParams<{ id: string }>();
  const draft = useLiveQuery(() => (id ? db.drafts.get(id) : undefined), [id]);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const overrides = useLiveQuery(() => db.personalRankings.toArray(), []);

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [hideOutIR, setHideOutIR] = useState(false);
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [winningTeamOnly, setWinningTeamOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hideDoNotDraft, setHideDoNotDraft] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("adp");
  const [confirmingPlayer, setConfirmingPlayer] = useState<Player | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  const draftedIds = useMemo(() => new Set((draft?.picks ?? []).map((p) => p.playerId)), [draft?.picks]);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players ?? []) map.set(p.id, p);
    return map;
  }, [players]);

  const handcuffs = useMemo(() => computeHandcuffs(players ?? []), [players]);

  const overridesById = useMemo(() => {
    const map = new Map((overrides ?? []).map((o) => [o.playerId, o]));
    return map;
  }, [overrides]);
  const favoriteIds = useMemo(() => new Set((overrides ?? []).filter((o) => o.favorite).map((o) => o.playerId)), [overrides]);
  const doNotDraftIds = useMemo(() => new Set((overrides ?? []).filter((o) => o.doNotDraft).map((o) => o.playerId)), [overrides]);

  // VORP/tiers/$ depend only on the player pool + this draft's settings,
  // never on picks.length — recomputing them on every pick would be both
  // wasteful and wrong (replacement level is a preseason baseline, not a
  // "best remaining" metric that shifts pick-to-pick).
  const settingsKey = draft ? `${draft.settings.teams}|${rosterSlotsKey(draft.settings.rosterSlots)}` : "";
  const metrics = useMemo(() => {
    if (!players || !draft) return null;
    const levels = replacementLevels(players, draft.settings.rosterSlots, draft.settings.teams);
    const vorp = computeVorp(players, levels);
    const auctionValues = computeAuctionValues(players, vorp, {
      teams: draft.settings.teams,
      rosterSlots: draft.settings.rosterSlots
    });
    const tiers = assignTiers(players);
    return { vorp, auctionValues, tiers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, settingsKey]);

  // "Quality remaining" uses positionRank (from ADP, always populated by
  // the M2 refresh) against the replacement rank for this league's
  // settings — spec §4.5's own definition. This works with or without
  // projections imported, unlike VORP which needs projPoints.
  const scarcityCounts = useMemo(() => {
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 } as Record<Position, number>;
    if (!players || !draft) return counts;
    const ranks = replacementRanks(draft.settings.rosterSlots, draft.settings.teams);
    for (const p of players) {
      if (draftedIds.has(p.id)) continue;
      if (p.positionRank !== null && p.positionRank <= ranks[p.position]) counts[p.position]++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, settingsKey, draftedIds]);

  const filteredSortedPlayers = useMemo(() => {
    if (!players) return [];
    const query = search.trim().toLowerCase();
    const sorted = players
      .filter((p) => (position === "ALL" ? true : p.position === position))
      .filter((p) => (query ? p.name.toLowerCase().includes(query) : true))
      .filter((p) => (hideDrafted ? !draftedIds.has(p.id) : true))
      .filter((p) => (hideOutIR ? !(p.injuryStatus && OUT_STATUSES.has(p.injuryStatus)) : true))
      .filter((p) => (rookiesOnly ? p.isRookie : true))
      .filter((p) => (winningTeamOnly ? p.winningTeam === true : true))
      .filter((p) => (favoritesOnly ? favoriteIds.has(p.id) : true))
      .filter((p) => (hideDoNotDraft ? !doNotDraftIds.has(p.id) : true));

    const rank = (p: Player): number => {
      switch (sortKey) {
        case "proj":
          return -(p.projPoints ?? -Infinity);
        case "vorp":
          return -(metrics?.vorp.get(p.id) ?? -Infinity);
        case "value":
          return -(metrics?.auctionValues.get(p.id) ?? -Infinity);
        case "tier":
          return metrics?.tiers.get(p.id)?.tier ?? Infinity;
        case "myrank":
          return overridesById.get(p.id)?.customRank ?? Infinity;
        case "adp":
        default:
          return p.adp ?? Infinity;
      }
    };

    return sorted.sort((a, b) => {
      // Compare ranks directly rather than subtracting first — two
      // players both missing the sorted metric produce Infinity - Infinity
      // (NaN), which broke the alphabetical tie-break below.
      const rankA = rank(a);
      const rankB = rank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [
    players,
    search,
    position,
    hideDrafted,
    hideOutIR,
    rookiesOnly,
    winningTeamOnly,
    favoritesOnly,
    hideDoNotDraft,
    favoriteIds,
    doNotDraftIds,
    draftedIds,
    sortKey,
    metrics,
    overridesById
  ]);

  if (!draft || !players || !metrics) {
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

  const myPicks = draft.picks.filter((p) => p.teamSlot === draft.settings.myDraftSlot);
  const rosterState = buildRosterState(myPicks, playersById, draft.settings.rosterSlots);

  const tierAlerts: string[] = [];
  if (isMyTurn) {
    const neededPositions = ALL_POSITIONS.filter((pos) =>
      rosterState.slots.some((s) => s.category === pos && s.player === null)
    );
    for (const pos of neededPositions) {
      const remaining = players
        .filter((p) => p.position === pos && !draftedIds.has(p.id))
        .map((p) => metrics.tiers.get(p.id)?.tier)
        .filter((t): t is number => t !== undefined);
      if (remaining.length === 0) continue;
      const bestTier = Math.min(...remaining);
      const countInTier = remaining.filter((t) => t === bestTier).length;
      if (countInTier <= 2) {
        tierAlerts.push(`Last ${countInTier} Tier ${bestTier} ${pos}${countInTier === 1 ? "" : "s"} on the board`);
      }
    }
  }

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
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn-secondary text-sm" onClick={() => setRosterOpen(true)}>
            My Roster
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setLogOpen(true)}>
            Draft Log
          </button>
        </div>
      </div>

      {isDraftOver ? (
        <div className="card p-6 text-center">Draft complete — every roster spot has been picked.</div>
      ) : (
        <>
          <TurnTracker
            onClock={onClock}
            onClockTeamName={onClockTeamName}
            isMyTurn={isMyTurn}
            myNextPick={myNextPick}
            picksUntilMine={picksUntilMine}
          />
          <TierAlertBanner alerts={tierAlerts} />
        </>
      )}

      <ScarcityMeter counts={scarcityCounts} />

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
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md bg-surface-sunken px-2 py-2 min-h-touch text-sm"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={hideDrafted} onChange={(e) => setHideDrafted(e.target.checked)} />
          Hide drafted
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={hideOutIR} onChange={(e) => setHideOutIR(e.target.checked)} />
          Hide Out/IR
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={rookiesOnly} onChange={(e) => setRookiesOnly(e.target.checked)} />
          Rookies only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={winningTeamOnly} onChange={(e) => setWinningTeamOnly(e.target.checked)} />
          Winning teams only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
          Favorites only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary min-h-touch px-2">
          <input type="checkbox" checked={hideDoNotDraft} onChange={(e) => setHideDoNotDraft(e.target.checked)} />
          Hide do-not-draft
        </label>
      </div>

      <div className="flex-1 min-h-0">
        <PlayerList
          players={filteredSortedPlayers}
          draftedIds={draftedIds}
          draftedByLabel={draftedByLabel}
          tierFor={(playerId) => metrics.tiers.get(playerId)?.tier ?? null}
          auctionValueFor={(playerId) => metrics.auctionValues.get(playerId) ?? null}
          favoriteIds={favoriteIds}
          doNotDraftIds={doNotDraftIds}
          onSelect={(player) => setConfirmingPlayer(player)}
          onInfo={(player) => setDetailPlayer(player)}
          onToggleFavorite={(player) => toggleFavorite(player.id)}
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

      {rosterOpen && <RosterPanel roster={rosterState} onClose={() => setRosterOpen(false)} />}

      {detailPlayer && (
        <PlayerDetailCard
          player={detailPlayer}
          tier={metrics.tiers.get(detailPlayer.id)?.tier ?? null}
          tierBasis={metrics.tiers.get(detailPlayer.id)?.basis ?? null}
          vorp={metrics.vorp.get(detailPlayer.id) ?? null}
          auctionValue={metrics.auctionValues.get(detailPlayer.id) ?? null}
          handcuff={(() => {
            // Spec §4.20: "on a starter's card, Handcuff: {backup}" — find
            // the backup whose handcuffOfPlayerId points at this player.
            for (const [backupId, starterId] of handcuffs) {
              if (starterId === detailPlayer.id) return playersById.get(backupId) ?? null;
            }
            return null;
          })()}
          draftedByLabel={draftedIds.has(detailPlayer.id) ? draftedByLabel(detailPlayer.id) : null}
          override={overridesById.get(detailPlayer.id)}
          onToggleFavorite={() => toggleFavorite(detailPlayer.id)}
          onToggleDoNotDraft={() => toggleDoNotDraft(detailPlayer.id)}
          onSaveNote={(note) => setNote(detailPlayer.id, note)}
          onClose={() => setDetailPlayer(null)}
        />
      )}
    </div>
  );
}
