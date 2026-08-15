import Papa from "papaparse";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 3000;
const FORMULA_LEAD_CHARS = new Set(["=", "+", "-", "@"]);

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

// CSV import is the app's primary untrusted-input path (spec §7b.2):
// enforce a size cap, parse with a real parser (never eval/hand-rolled
// string execution), and neutralize any cell that could be interpreted
// as a spreadsheet formula if the data is later re-exported.
function sanitizeCell(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0 && FORMULA_LEAD_CHARS.has(trimmed[0])) {
    return `'${trimmed}`;
  }
  return value;
}

export async function parseCsvFile(file: File): Promise<CsvParseResult> {
  if (file.size > MAX_CSV_BYTES) {
    return { headers: [], rows: [], errors: [`File is too large (${Math.round(file.size / 1024)} KB, limit 5 MB).`] };
  }

  const text = await file.text();

  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => sanitizeCell(value),
      complete: (results) => {
        const errors = results.errors.slice(0, 20).map((e) => `Row ${e.row ?? "?"}: ${e.message}`);
        let rows = results.data;
        if (rows.length > MAX_ROWS) {
          errors.push(`Truncated to first ${MAX_ROWS} rows (file had ${rows.length}).`);
          rows = rows.slice(0, MAX_ROWS);
        }
        resolve({
          headers: results.meta.fields ?? [],
          rows,
          errors
        });
      },
      error: (err: Error) => {
        resolve({ headers: [], rows: [], errors: [err.message] });
      }
    });
  });
}

// One unified CSV mapping covers every field the spec has no free API
// for: projections (§2.3), contract year (§4.12), the two winning-team
// signals (§4.13), strength of schedule (§4.21), and usage stats
// (§4.22 — nflverse is "fine to bundle/refresh during prep" but building
// a live fetcher/aggregator against its raw data is a lot of fragile
// surface for a SHOULD; CSV import is the same user-controlled path the
// spec already prescribes for projections, so usage rides along it too).
export interface ProjectionColumnMapping {
  name: string;
  team?: string;
  position?: string;
  projPoints?: string;
  contractYear?: string;
  teamWinningRecordLastYear?: string;
  teamProjectedWinning?: string;
  sosSeason?: string;
  sosPlayoffs?: string;
  snapPct?: string;
  targetShare?: string;
  rzTouches?: string;
}

export interface MappedProjectionRow {
  name: string;
  team: string | null;
  position: string | null;
  projPoints: number | null;
  contractYear: boolean | null;
  teamWinningRecordLastYear: boolean | null;
  teamProjectedWinning: boolean | null;
  sosSeason: number | null;
  sosPlayoffs: number | null;
  snapPct: number | null;
  targetShare: number | null;
  rzTouches: number | null;
}

const TRUTHY = new Set(["true", "yes", "y", "1"]);

function toBool(row: Record<string, string>, column: string | undefined): boolean | null {
  if (!column) return null;
  const raw = row[column]?.trim().toLowerCase();
  return raw ? TRUTHY.has(raw) : null;
}

function toNum(row: Record<string, string>, column: string | undefined): number | null {
  if (!column) return null;
  const raw = row[column];
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: ProjectionColumnMapping
): MappedProjectionRow[] {
  return rows
    .map((row) => {
      const name = row[mapping.name]?.trim();
      if (!name) return null;
      return {
        name,
        team: mapping.team ? row[mapping.team]?.trim() || null : null,
        position: mapping.position ? row[mapping.position]?.trim().toUpperCase() || null : null,
        projPoints: toNum(row, mapping.projPoints),
        contractYear: toBool(row, mapping.contractYear),
        teamWinningRecordLastYear: toBool(row, mapping.teamWinningRecordLastYear),
        teamProjectedWinning: toBool(row, mapping.teamProjectedWinning),
        sosSeason: toNum(row, mapping.sosSeason),
        sosPlayoffs: toNum(row, mapping.sosPlayoffs),
        snapPct: toNum(row, mapping.snapPct),
        targetShare: toNum(row, mapping.targetShare),
        rzTouches: toNum(row, mapping.rzTouches)
      };
    })
    .filter((r): r is MappedProjectionRow => r !== null);
}
