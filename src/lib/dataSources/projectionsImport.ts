import { db } from "@/lib/db";
import type { Player } from "@/lib/types";
import { normalizeName, normalizeTeam, playerMatchKey } from "./normalize";
import type { MappedProjectionRow } from "./csvImport";

export interface ProjectionImportSummary {
  matched: number;
  unmatched: string[];
}

function nameTeamKey(name: string, team: string): string {
  return `${normalizeName(name)}|${normalizeTeam(team)}`;
}

function nameTeamPositionKey(name: string, team: string, position: string): string {
  return `${normalizeName(name)}|${normalizeTeam(team)}|${position}`;
}

// Pure matching + field-merge step (same rationale as pickRepo.ts's
// apply* functions — the highest-risk logic here, matching an arbitrary
// CSV row onto the right local player, is unit-testable without a
// Dexie/IndexedDB environment this way). Only touches the fields the
// CSV actually mapped, so it can never wipe Sleeper/ADP data (spec
// §4.26, §7b.2) — and never writes row.team/row.position/row.name back
// onto the matched player; those exist only to *find* the right record.
export function matchProjectionRows(rows: MappedProjectionRow[], allPlayers: Player[]): { updates: Player[]; unmatched: string[] } {
  // Two players sharing a first+last name across different teams (or
  // positions) is common enough — a name-only match would silently pick
  // one of them, or the earlier all-players-must-be-unique behavior
  // would just refuse to match either. Team and position are only ever
  // used to *find* the right player here, in whichever combination the
  // CSV actually mapped (most specific first) — see the field-by-field
  // update below, which never writes row.team/row.position back onto
  // the matched player.
  const byNameTeamPosition = new Map<string, Player>();
  const byNameAndPosition = new Map<string, Player>();
  const byNameAndTeam = new Map<string, Player>();
  const byNameOnly = new Map<string, Player[]>();
  for (const p of allPlayers) {
    byNameTeamPosition.set(nameTeamPositionKey(p.name, p.team, p.position), p);
    byNameAndPosition.set(playerMatchKey(p.name, p.position), p);
    byNameAndTeam.set(nameTeamKey(p.name, p.team), p);
    const nameKey = normalizeName(p.name);
    const list = byNameOnly.get(nameKey) ?? [];
    list.push(p);
    byNameOnly.set(nameKey, list);
  }

  const updates: Player[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    let target: Player | undefined;
    if (row.team && row.position) {
      target = byNameTeamPosition.get(nameTeamPositionKey(row.name, row.team, row.position));
    }
    if (!target && row.position) {
      target = byNameAndPosition.get(playerMatchKey(row.name, row.position));
    }
    if (!target && row.team) {
      target = byNameAndTeam.get(nameTeamKey(row.name, row.team));
    }
    if (!target) {
      // No team/position mapped (or neither narrowed it down) — only
      // safe when the name alone is unambiguous in the local dataset.
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

  return { updates, unmatched };
}

export async function applyProjectionImport(rows: MappedProjectionRow[]): Promise<ProjectionImportSummary> {
  const allPlayers = await db.players.toArray();
  const { updates, unmatched } = matchProjectionRows(rows, allPlayers);

  if (updates.length > 0) {
    await db.players.bulkPut(updates);
  }

  return { matched: updates.length, unmatched };
}
