import { db } from "@/lib/db";
import type { Player, ScoringFormat } from "@/lib/types";
import { fetchSleeperPlayers, fetchTrendingAddCounts } from "./sleeper";
import { fetchAdp } from "./ffcalc";
import { normalizeName, normalizeTeam, playerMatchKey } from "./normalize";

// Positions where FFC's spelling differs from Sleeper's (our canonical
// set) even though the player names themselves match directly. DST isn't
// here — its names don't match at all, so it's handled separately via
// dstByTeam below.
const FFC_POSITION_MAP: Record<string, Player["position"]> = {
  PK: "K"
};

export interface SourceOutcome {
  ok: boolean;
  count: number | null;
  error: string | null;
  at: string;
}

export interface RefreshResult {
  sleeper: SourceOutcome;
  adp: SourceOutcome;
  playersWritten: number;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyPlayer(base: {
  id: string;
  name: string;
  team: string;
  position: Player["position"];
  injuryStatus: string | null;
  isRookie: boolean;
  depthChartOrder: number | null;
  depthChartPos: string | null;
}): Player {
  return {
    ...base,
    byeWeek: null,
    contractYear: null,
    teamWinningRecordLastYear: null,
    teamProjectedWinning: null,
    winningTeam: null,
    handcuffOfPlayerId: null,
    adp: null,
    adpStdDev: null,
    projPoints: null,
    positionRank: null,
    overallRank: null,
    tier: null,
    vorp: null,
    auctionValue: null,
    sosSeason: null,
    sosPlayoffs: null,
    usage: null,
    trendingAddCount: null,
    lastUpdated: nowIso()
  };
}

// Orchestrates the prep-step sources into the local `players` dataset.
// Each source fails independently (spec §4.26 "resilient — if one source
// fails, keep the others"). The merged result is fully built in memory and
// only written to IndexedDB after Sleeper — the base of the dataset —
// succeeds, so a bad refresh can never leave the table half-populated
// (spec §7b.5).
export async function refreshPlayerData(settings: {
  teams: number;
  scoring: ScoringFormat;
  year: number;
}): Promise<RefreshResult> {
  const at = nowIso();
  let sleeperOutcome: SourceOutcome = { ok: false, count: null, error: null, at };
  let adpOutcome: SourceOutcome = { ok: false, count: null, error: null, at };

  const players = new Map<string, Player>();
  const matchIndex = new Map<string, string>(); // matchKey -> player id
  // Defenses can't be name-matched: FFC lists them as "Denver Defense"
  // (position "DEF"), Sleeper as "DEN DST" (position "DST") — no shared
  // text between the two. Both sources do agree on team abbreviation, so
  // DST alone matches by team code instead.
  const dstByTeam = new Map<string, string>(); // normalized team -> player id

  try {
    const sleeperPlayers = await fetchSleeperPlayers();
    for (const sp of sleeperPlayers) {
      const player = emptyPlayer(sp);
      players.set(player.id, player);
      matchIndex.set(playerMatchKey(sp.name, sp.position), sp.id);
      if (sp.position === "DST") dstByTeam.set(normalizeTeam(sp.team), sp.id);
    }
    sleeperOutcome = { ok: true, count: sleeperPlayers.length, error: null, at };

    try {
      const trending = await fetchTrendingAddCounts();
      for (const [playerId, count] of trending) {
        const p = players.get(playerId);
        if (p) p.trendingAddCount = count;
      }
    } catch {
      // Trending is a best-effort buzz signal (spec §2.5) — never blocks the refresh.
    }
  } catch (err) {
    sleeperOutcome = { ok: false, count: null, error: (err as Error).message, at };
  }

  if (!sleeperOutcome.ok) {
    // No base dataset to merge onto — leave the existing cached players
    // table untouched and report the failure.
    return { sleeper: sleeperOutcome, adp: adpOutcome, playersWritten: 0 };
  }

  try {
    const adpEntries = await fetchAdp({ teams: settings.teams, scoring: settings.scoring, year: settings.year });
    const ranked = [...adpEntries].sort((a, b) => a.adp - b.adp);
    const positionCounters = new Map<string, number>();

    ranked.forEach((entry, index) => {
      const isDst = entry.position === "DEF";
      // FFC spells some positions differently than Sleeper (our canonical
      // set) even though the player names themselves match fine — kickers
      // are "PK" there, "K" here. Same mismatch class as DST below, just
      // fixable by translating the position instead of matching by team.
      const canonicalPosition = FFC_POSITION_MAP[entry.position] ?? entry.position;
      const playerId = isDst
        ? dstByTeam.get(normalizeTeam(entry.team))
        : matchIndex.get(playerMatchKey(entry.name, canonicalPosition));
      if (!playerId) return;
      const player = players.get(playerId);
      if (!player) return;

      const posKey = isDst ? "DST" : canonicalPosition;
      const posCount = (positionCounters.get(posKey) ?? 0) + 1;
      positionCounters.set(posKey, posCount);

      player.adp = entry.adp;
      player.adpStdDev = entry.adpStdDev;
      player.byeWeek = entry.bye ?? player.byeWeek;
      player.overallRank = index + 1;
      player.positionRank = posCount;
      if (entry.team) player.team = normalizeTeam(entry.team);
    });
    adpOutcome = { ok: true, count: adpEntries.length, error: null, at };
  } catch (err) {
    adpOutcome = { ok: false, count: null, error: (err as Error).message, at };
    // ADP failing still leaves a fully valid dataset (ADP-derived fields
    // just stay null) — this is graceful degradation, not partial/garbage
    // data, so it's safe to write.
  }

  const finalPlayers = Array.from(players.values());
  if (finalPlayers.length === 0) {
    return { sleeper: sleeperOutcome, adp: adpOutcome, playersWritten: 0 };
  }

  await db.transaction("rw", db.players, async () => {
    await db.players.clear();
    await db.players.bulkAdd(finalPlayers);
  });

  return { sleeper: sleeperOutcome, adp: adpOutcome, playersWritten: finalPlayers.length };
}

export { normalizeName };
