import { fetchWithTimeout } from "./fetchWithTimeout";
import type { SeasonStatLine } from "@/lib/types";

const STATS_URL = (season: number) => `https://api.sleeper.app/v1/stats/nfl/regular/${season}`;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Sleeper's season stats payload carries hundreds of raw stat categories
// per player (special teams, penalties, etc.) we don't use — pluck only
// the fields the player card actually shows, rather than validating (or
// storing) the whole blob against schema drift we don't care about.
export async function fetchSeasonStats(season: number): Promise<Map<string, SeasonStatLine>> {
  const res = await fetchWithTimeout(STATS_URL(season), 30000);
  if (!res.ok) throw new Error(`Sleeper stats request failed for ${season} (${res.status})`);
  const json = (await res.json()) as unknown;
  if (typeof json !== "object" || json === null) {
    throw new Error(`Sleeper stats response for ${season} wasn't an object`);
  }

  const out = new Map<string, SeasonStatLine>();
  for (const [playerId, raw] of Object.entries(json as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const gamesPlayed = num(r.gp);
    const pointsPpr = num(r.pts_ppr);
    const pointsStd = num(r.pts_std);
    const pointsHalfPpr = num(r.pts_half_ppr);
    // Skip entries with no real season (e.g. inactive/practice-squad
    // players Sleeper still lists with an empty stat object).
    if (gamesPlayed === null && pointsPpr === null && pointsStd === null) continue;

    out.set(playerId, {
      season,
      gamesPlayed,
      pointsStd,
      pointsHalfPpr,
      pointsPpr,
      passYd: num(r.pass_yd),
      passTd: num(r.pass_td),
      rushYd: num(r.rush_yd),
      rushTd: num(r.rush_td),
      rec: num(r.rec),
      recYd: num(r.rec_yd),
      recTd: num(r.rec_td)
    });
  }
  return out;
}
