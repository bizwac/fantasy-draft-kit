import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { locationForOverallPick, nextPickForSlot, rosterSlotCount } from "@/lib/draftMath";
import { addPick, autoPickCpu, correctPick, deletePick, undoLastPick } from "@/lib/pickRepo";
import { setTimerRunning } from "@/lib/draftRepo";
import { assignTiers, computeAuctionValues, computeVorp, replacementLevels, replacementRanks } from "@/lib/valueMetrics";
import { buildRosterState } from "@/lib/rosterTracker";
import { computeHandcuffs } from "@/lib/handcuff";
import { setNote, toggleDoNotDraft, toggleFavorite } from "@/lib/personalRepo";
import { loadTimerSettings } from "@/lib/timerSettings";
import { loadColumnSettings, visibleOrderedColumns } from "@/lib/columnSettings";
import type { Player, Position, RosterSlots } from "@/lib/types";
import TurnTracker from "@/components/draftBoard/TurnTracker";
import PlayerList from "@/components/draftBoard/PlayerList";
import FilterMenu from "@/components/draftBoard/FilterMenu";
import ConfirmDraftSheet from "@/components/draftBoard/ConfirmDraftSheet";
import DraftLogPanel from "@/components/draftBoard/DraftLogPanel";
import ScarcityMeter from "@/components/draftBoard/ScarcityMeter";
import TierAlertBanner from "@/components/draftBoard/TierAlertBanner";
import RosterPanel from "@/components/draftBoard/RosterPanel";
import PlayerDetailCard from "@/components/player/PlayerDetailCard";
import Badge from "@/components/player/Badge";

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

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M9 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4h6v6M20 4l-9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const seasonStats = useLiveQuery(() => db.seasonStats.toArray(), []);

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
  const [timerSettings] = useState(() => loadTimerSettings());
  const [columns] = useState(() => visibleOrderedColumns(loadColumnSettings()));

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

  const isDraftOver = draft ? draft.picks.length >= draft.settings.teams * rosterSlotCount(draft.settings.rosterSlots) : false;
  useEffect(() => {
    if (draft && isDraftOver && draft.status !== "complete") {
      db.drafts.update(draft.id, { status: "complete" });
    }
  }, [draft, isDraftOver]);

  // Mock drafts auto-pick for every team but mine: best ADP-available,
  // instantly, the moment it's their turn. Re-fires after each pick
  // (draft.picks.length changing produces a new `draft` via the live
  // query), chaining through consecutive CPU turns until it lands back
  // on my slot or the draft ends. autoPickCpu computes on-the-clock and
  // writes the pick inside one Dexie transaction (see pickRepo.ts) —
  // it doesn't trust the `draft` snapshot captured here for *who* to
  // assign the pick to, only for *whether to attempt one at all*, since
  // that snapshot can go stale against a concurrent manual pick.
  // autoPickingRef just avoids two overlapping attempts from this
  // effect itself.
  const autoPickingRef = useRef(false);
  useEffect(() => {
    if (!draft || !players || !draft.isMock || isDraftOver) return;
    if (autoPickingRef.current) return;
    autoPickingRef.current = true;
    autoPickCpu(draft.id, players, draft.settings.myDraftSlot).finally(() => {
      autoPickingRef.current = false;
    });
  }, [draft, players, isDraftOver]);

  if (!draft || !players || !metrics) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  const lastSeasonPtsById = new Map<string, number | null>();
  for (const s of seasonStats ?? []) {
    const latest = s.seasons[0];
    if (!latest) continue;
    const pts =
      draft.settings.scoring === "std"
        ? latest.pointsStd
        : draft.settings.scoring === "half"
          ? latest.pointsHalfPpr
          : latest.pointsPpr;
    lastSeasonPtsById.set(s.playerId, pts);
  }

  const totalRounds = rosterSlotCount(draft.settings.rosterSlots);
  const onClock = locationForOverallPick(draft.picks.length + 1, draft.settings.teams);
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
    <div className="flex flex-col gap-4 h-full" style={{ paddingTop: "var(--content-pt)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-display font-semibold truncate flex items-center gap-2">
          {draft.name}
          {draft.isMock && <Badge tone="info">Mock</Badge>}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-secondary text-sm" onClick={() => setRosterOpen(true)}>
            My Roster
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => setLogOpen(true)}>
            Draft Log
          </button>
          <Link to={`/draft/${id}/setup`} className="btn-secondary text-sm">
            Edit Settings
          </Link>
          <Link to={`/draft/${id}/results`} className="btn-secondary text-sm">
            Results
          </Link>
          <Link
            to={`/draft/${id}/present`}
            target="_blank"
            rel="noopener"
            className="btn-secondary text-sm px-2.5 sm:px-4"
            aria-label="Live View (opens in a new tab)"
            title="Live View"
          >
            <span className="hidden sm:inline">Live View</span>
            <ExternalLinkIcon />
          </Link>
        </div>
      </div>

      {isDraftOver ? (
        <div className="card p-6 text-center flex flex-col items-center gap-3">
          <p>Draft complete — every roster spot has been picked.</p>
          <Link to={`/draft/${id}/results`} className="btn-primary">
            View Results
          </Link>
        </div>
      ) : (
        <>
          <TurnTracker
            onClock={onClock}
            onClockTeamName={onClockTeamName}
            isMyTurn={isMyTurn}
            myNextPick={myNextPick}
            picksUntilMine={picksUntilMine}
            timerSettings={timerSettings}
            timerRunning={!!draft.timerRunning}
            onToggleTimerRunning={() => id && setTimerRunning(id, !draft.timerRunning)}
          />
          <TierAlertBanner alerts={tierAlerts} />
        </>
      )}

      <ScarcityMeter counts={scarcityCounts} />

      <div className="flex flex-col gap-2">
        <input
          type="search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md bg-surface-sunken px-3 py-2 min-h-touch w-full"
        />
        <div className="flex flex-nowrap items-center gap-2">
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as Position | "ALL")}
            className="select min-h-touch text-sm flex-1 min-w-0"
            aria-label="Position filter"
          >
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos === "ALL" ? "All positions" : pos}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="select min-h-touch text-sm flex-1 min-w-0"
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
          <FilterMenu
            options={[
              { key: "hideDrafted", label: "Hide drafted", checked: hideDrafted, onChange: setHideDrafted },
              { key: "hideOutIR", label: "Hide Out/IR", checked: hideOutIR, onChange: setHideOutIR },
              { key: "rookiesOnly", label: "Rookies only", checked: rookiesOnly, onChange: setRookiesOnly },
              { key: "winningTeamOnly", label: "Winning teams only", checked: winningTeamOnly, onChange: setWinningTeamOnly },
              { key: "favoritesOnly", label: "Favorites only", checked: favoritesOnly, onChange: setFavoritesOnly },
              { key: "hideDoNotDraft", label: "Hide do-not-draft", checked: hideDoNotDraft, onChange: setHideDoNotDraft }
            ]}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <PlayerList
          players={filteredSortedPlayers}
          draftedIds={draftedIds}
          draftedByLabel={draftedByLabel}
          columns={columns}
          tierFor={(playerId) => metrics.tiers.get(playerId)?.tier ?? null}
          auctionValueFor={(playerId) => metrics.auctionValues.get(playerId) ?? null}
          lastSeasonPtsFor={(playerId) => lastSeasonPtsById.get(playerId) ?? null}
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
          playerFor={(playerId) => playersById.get(playerId)}
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
          scoring={draft.settings.scoring}
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
