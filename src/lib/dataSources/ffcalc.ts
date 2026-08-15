import { fetchWithTimeout } from "./fetchWithTimeout";
import { FfcAdpResponseSchema, type FfcAdpPlayer } from "./schema";
import type { ScoringFormat } from "@/lib/types";

// Fantasy Football Calculator's API sends no CORS headers, so the browser
// can't call it directly (verified: curl succeeds, browser fetch is
// blocked). /api/adp is a same-origin passthrough — see api/adp.ts.
const BASE_URL = "/api/adp";

const FORMAT_MAP: Record<ScoringFormat, string> = {
  ppr: "ppr",
  half: "half-ppr",
  std: "standard",
  "superflex-ppr": "ppr" // FFCalc has no superflex format; PPR ADP is the closest baseline
};

export interface AdpEntry {
  name: string;
  position: string;
  team: string | null;
  bye: number | null;
  adp: number;
  adpStdDev: number | null;
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toAdpEntry(p: FfcAdpPlayer): AdpEntry | null {
  const adp = toNumber(p.adp);
  if (adp === null) return null;
  return {
    name: p.name,
    position: p.position,
    team: p.team ?? null,
    bye: toNumber(p.bye),
    adp,
    adpStdDev: toNumber(p.stdev)
  };
}

export async function fetchAdp(options: {
  teams: number;
  scoring: ScoringFormat;
  year: number;
}): Promise<AdpEntry[]> {
  const format = FORMAT_MAP[options.scoring];
  const url = `${BASE_URL}?format=${format}&teams=${options.teams}&year=${options.year}`;
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) throw new Error(`FFCalc ADP request failed (${res.status})`);
  const json = await res.json();
  const parsed = FfcAdpResponseSchema.parse(json);
  return parsed.players.map(toAdpEntry).filter((e): e is AdpEntry => e !== null);
}
