import { db } from "@/lib/db";
import type { Player } from "@/lib/types";
import { normalizeName, playerMatchKey } from "./normalize";
import type { MappedProjectionRow } from "./csvImport";

export interface ProjectionImportSummary {
  matched: number;
  unmatched: string[];
}

// Applies imported projections/contract-year data onto the already-cached
// `players` table. Runs entirely offline — no network — and only touches
// the fields the CSV actually mapped, so it can never wipe Sleeper/ADP
// data (spec §4.26, §7b.2).
export async function applyProjectionImport(rows: MappedProjectionRow[]): Promise<ProjectionImportSummary> {
  const allPlayers = await db.players.toArray();

  const byNameAndPosition = new Map<string, Player>();
  const byNameOnly = new Map<string, Player[]>();
  for (const p of allPlayers) {
    byNameAndPosition.set(playerMatchKey(p.name, p.position), p);
    const nameKey = normalizeName(p.name);
    const list = byNameOnly.get(nameKey) ?? [];
    list.push(p);
    byNameOnly.set(nameKey, list);
  }

  const updates: Player[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    let target: Player | undefined;
    if (row.position) {
      target = byNameAndPosition.get(playerMatchKey(row.name, row.position));
    }
    if (!target) {
      const candidates = byNameOnly.get(normalizeName(row.name));
      if (candidates?.length === 1) target = candidates[0];
    }
    if (!target) {
      unmatched.push(row.name);
      continue;
    }

    const updated: Player = { ...target, lastUpdated: new Date().toISOString() };
    if (row.projPoints !== null) updated.projPoints = row.projPoints;
    if (row.contractYear !== null) updated.contractYear = row.contractYear;
    updates.push(updated);
  }

  if (updates.length > 0) {
    await db.players.bulkPut(updates);
  }

  return { matched: updates.length, unmatched };
}
