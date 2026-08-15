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
    if (row.sosSeason !== null) updated.sosSeason = row.sosSeason;
    if (row.sosPlayoffs !== null) updated.sosPlayoffs = row.sosPlayoffs;
    if (row.snapPct !== null || row.targetShare !== null || row.rzTouches !== null) {
      updated.usage = {
        snapPct: row.snapPct ?? updated.usage?.snapPct ?? null,
        targetShare: row.targetShare ?? updated.usage?.targetShare ?? null,
        rzTouches: row.rzTouches ?? updated.usage?.rzTouches ?? null,
        season: updated.usage?.season ?? null
      };
    }
    // winningTeam (spec §4.13) fires only when both sub-signals are true;
    // an import touching just one preserves the other's prior value.
    if (row.teamWinningRecordLastYear !== null) updated.teamWinningRecordLastYear = row.teamWinningRecordLastYear;
    if (row.teamProjectedWinning !== null) updated.teamProjectedWinning = row.teamProjectedWinning;
    if (row.teamWinningRecordLastYear !== null || row.teamProjectedWinning !== null) {
      updated.winningTeam =
        updated.teamWinningRecordLastYear === true && updated.teamProjectedWinning === true
          ? true
          : updated.teamWinningRecordLastYear === false || updated.teamProjectedWinning === false
            ? false
            : null;
    }
    updates.push(updated);
  }

  if (updates.length > 0) {
    await db.players.bulkPut(updates);
  }

  return { matched: updates.length, unmatched };
}
