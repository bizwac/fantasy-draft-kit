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

export interface ProjectionColumnMapping {
  name: string;
  team?: string;
  position?: string;
  projPoints?: string;
  contractYear?: string;
}

export interface MappedProjectionRow {
  name: string;
  team: string | null;
  position: string | null;
  projPoints: number | null;
  contractYear: boolean | null;
}

const TRUTHY = new Set(["true", "yes", "y", "1"]);

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: ProjectionColumnMapping
): MappedProjectionRow[] {
  return rows
    .map((row) => {
      const name = row[mapping.name]?.trim();
      if (!name) return null;
      const projRaw = mapping.projPoints ? row[mapping.projPoints] : undefined;
      const projPoints = projRaw !== undefined && projRaw !== "" ? Number(projRaw) : null;
      const contractRaw = mapping.contractYear ? row[mapping.contractYear]?.trim().toLowerCase() : undefined;
      return {
        name,
        team: mapping.team ? row[mapping.team]?.trim() || null : null,
        position: mapping.position ? row[mapping.position]?.trim().toUpperCase() || null : null,
        projPoints: projPoints !== null && Number.isFinite(projPoints) ? projPoints : null,
        contractYear: contractRaw !== undefined ? TRUTHY.has(contractRaw) : null
      };
    })
    .filter((r): r is MappedProjectionRow => r !== null);
}
