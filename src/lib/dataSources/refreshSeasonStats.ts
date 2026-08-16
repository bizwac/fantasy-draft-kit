import { db } from "@/lib/db";
import type { SeasonStatLine } from "@/lib/types";
import { fetchSeasonStats } from "./sleeperStats";

export interface SeasonStatsRefreshResult {
  seasons: number[];
  playersUpdated: number;
  errors: string[];
}

// Manual, separate from refreshPlayerData on purpose — each season is a
// ~2MB fetch and, once a season's final, it never changes, so there's no
// reason to re-pull it on the same 24h cadence as live ADP/injury data.
export async function refreshSeasonStats(seasons: number[]): Promise<SeasonStatsRefreshResult> {
  const byPlayer = new Map<string, SeasonStatLine[]>();
  const errors: string[] = [];

  for (const season of seasons) {
    try {
      const seasonMap = await fetchSeasonStats(season);
      for (const [playerId, line] of seasonMap) {
        const list = byPlayer.get(playerId) ?? [];
        list.push(line);
        byPlayer.set(playerId, list);
      }
    } catch (err) {
      errors.push(`${season}: ${(err as Error).message}`);
    }
  }

  const now = new Date().toISOString();
  const records = Array.from(byPlayer.entries()).map(([playerId, seasonsList]) => ({
    playerId,
    seasons: seasonsList.sort((a, b) => b.season - a.season),
    lastUpdated: now
  }));

  if (records.length > 0) {
    await db.seasonStats.bulkPut(records);
  }

  return { seasons, playersUpdated: records.length, errors };
}
