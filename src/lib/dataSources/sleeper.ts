import { fetchWithTimeout } from "./fetchWithTimeout";
import {
  SleeperPlayerRawSchema,
  SleeperPlayersResponseSchema,
  SleeperTrendingResponseSchema,
  type SleeperPlayerRaw
} from "./schema";
import type { Position } from "@/lib/types";

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const TRENDING_ADD_URL = "https://api.sleeper.app/v1/players/nfl/trending/add?limit=50";

const POSITION_MAP: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST"
};

export interface NormalizedSleeperPlayer {
  id: string;
  name: string;
  team: string;
  position: Position;
  injuryStatus: string | null;
  isRookie: boolean;
  depthChartOrder: number | null;
  depthChartPos: string | null;
}

function toDisplayName(raw: SleeperPlayerRaw): string {
  if (raw.full_name) return raw.full_name;
  const parts = [raw.first_name, raw.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  // Defense entries carry no name fields — player_id is the team code.
  return `${raw.team ?? raw.player_id} DST`;
}

// Sleeper explicitly asks callers to fetch this at most once per day
// (spec §2.1) — the Data Refresh screen is the only place this is called,
// never a background poll.
export async function fetchSleeperPlayers(): Promise<NormalizedSleeperPlayer[]> {
  const res = await fetchWithTimeout(PLAYERS_URL, 20000);
  if (!res.ok) throw new Error(`Sleeper players request failed (${res.status})`);
  const json = await res.json();
  const record = SleeperPlayersResponseSchema.parse(json);

  const out: NormalizedSleeperPlayer[] = [];
  for (const value of Object.values(record)) {
    const parsed = SleeperPlayerRawSchema.safeParse(value);
    if (!parsed.success) continue;
    const raw = parsed.data;
    const position = raw.position ? POSITION_MAP[raw.position] : undefined;
    if (!position) continue; // skip non-fantasy positions (OL, LS, etc.)

    out.push({
      id: raw.player_id,
      name: toDisplayName(raw),
      team: raw.team ?? "FA",
      position,
      injuryStatus: raw.injury_status ?? null,
      isRookie: raw.years_exp === 0,
      depthChartOrder: raw.depth_chart_order ?? null,
      depthChartPos: raw.depth_chart_position ?? null
    });
  }
  if (out.length < 100) {
    throw new Error("Sleeper response looked incomplete — refusing to use it");
  }
  return out;
}

export async function fetchTrendingAddCounts(): Promise<Map<string, number>> {
  const res = await fetchWithTimeout(TRENDING_ADD_URL, 10000);
  if (!res.ok) throw new Error(`Sleeper trending request failed (${res.status})`);
  const json = await res.json();
  const entries = SleeperTrendingResponseSchema.parse(json);
  return new Map(entries.map((e) => [e.player_id, e.count]));
}
