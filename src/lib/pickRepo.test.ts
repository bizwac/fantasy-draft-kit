import { describe, expect, it } from "vitest";
import { applyAddPick, applyCorrectPick, applyDeletePick, applyUndoLastPick, chooseCpuPick } from "./pickRepo";
import { locationForOverallPick, rosterSlotCount } from "./draftMath";
import type { Pick, Player, RosterSlots } from "./types";

// Deterministic PRNG (mulberry32) so a failure is reproducible from the
// printed seed rather than flaking on Math.random().
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertInvariants(picks: Pick[], teams: number) {
  const playerIds = picks.map((p) => p.playerId);
  expect(new Set(playerIds).size).toBe(playerIds.length); // no player drafted twice

  const overalls = picks.map((p) => p.overall).sort((a, b) => a - b);
  expect(overalls).toEqual(Array.from({ length: picks.length }, (_, i) => i + 1)); // dense 1..N, no gaps/dupes

  for (const pick of picks) {
    const expected = locationForOverallPick(pick.overall, teams);
    expect(pick.round).toBe(expected.round);
    expect(pick.slotInRound).toBe(expected.slotInRound);
  }
}

describe("pick log invariants under random add/undo/correct/delete sequences", () => {
  it("never duplicates a player and always reconciles counts, for 50 random seeds", () => {
    const teams = 4;
    const playerPool = Array.from({ length: 25 }, (_, i) => `p${i + 1}`);

    for (let seed = 0; seed < 50; seed++) {
      const rand = mulberry32(seed);
      let picks: Pick[] = [];

      for (let step = 0; step < 60; step++) {
        const draftedIds = new Set(picks.map((p) => p.playerId));
        const available = playerPool.filter((id) => !draftedIds.has(id));
        const action = rand();

        if (action < 0.55 && available.length > 0) {
          const playerId = available[Math.floor(rand() * available.length)];
          const teamSlot = 1 + Math.floor(rand() * teams);
          picks = applyAddPick(picks, playerId, teamSlot, teams);
        } else if (action < 0.7 && picks.length > 0) {
          picks = applyUndoLastPick(picks);
        } else if (action < 0.85 && picks.length > 0) {
          const overall = 1 + Math.floor(rand() * picks.length);
          const newTeamSlot = 1 + Math.floor(rand() * teams);
          picks = applyCorrectPick(picks, overall, { teamSlot: newTeamSlot });
        } else if (picks.length > 0) {
          const overall = 1 + Math.floor(rand() * picks.length);
          picks = applyDeletePick(picks, overall, teams);
        }

        assertInvariants(picks, teams);
      }
    }
  });
});

describe("applyAddPick", () => {
  it("is a no-op if the player is already drafted (never double-drafts)", () => {
    const picks = applyAddPick([], "p1", 1, 4);
    const again = applyAddPick(picks, "p1", 2, 4);
    expect(again).toBe(picks); // same reference: true no-op
    expect(again).toHaveLength(1);
  });
});

describe("applyDeletePick", () => {
  it("returns the deleted player to the pool and renumbers only the picks after it", () => {
    let picks = applyAddPick([], "p1", 1, 4);
    picks = applyAddPick(picks, "p2", 2, 4);
    picks = applyAddPick(picks, "p3", 3, 4);

    const afterDelete = applyDeletePick(picks, 2, 4); // delete p2's pick
    expect(afterDelete.map((p) => p.playerId)).toEqual(["p1", "p3"]);
    expect(afterDelete.map((p) => p.overall)).toEqual([1, 2]);
    // p1's pick (still overall 1) is untouched by the shift
    expect(afterDelete[0].corrected).toBe(false);
    // p3 shifted from overall 3 -> 2, so it's flagged corrected
    expect(afterDelete[1].corrected).toBe(true);
  });
});

function makeCpuTestPlayer(id: string, position: Player["position"], adp: number): Player {
  return {
    id,
    name: id,
    team: "FA",
    position,
    byeWeek: null,
    injuryStatus: null,
    isRookie: false,
    contractYear: null,
    teamWinningRecordLastYear: null,
    teamProjectedWinning: null,
    winningTeam: null,
    depthChartOrder: null,
    depthChartPos: null,
    handcuffOfPlayerId: null,
    adp,
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
    lastUpdated: new Date().toISOString()
  };
}

// RB/WR cheap and plentiful early (like a real board), QB/TE spread
// through the middle, K/DST deliberately pushed to the very end of the
// ADP order — exactly the shape that would starve a pure best-ADP bot
// of a kicker/defense (or a second starting position) if the
// needs-forcing in chooseCpuPick didn't kick in.
function buildCpuTestPool(): Player[] {
  const players: Player[] = [];
  let id = 0;
  const push = (position: Player["position"], count: number, startAdp: number, step: number) => {
    for (let i = 0; i < count; i++) {
      id++;
      players.push(makeCpuTestPlayer(`p${id}`, position, startAdp + i * step));
    }
  };
  push("RB", 60, 1, 3);
  push("WR", 60, 2, 3);
  push("QB", 20, 10, 8);
  push("TE", 20, 20, 9);
  push("DST", 10, 140, 5);
  push("K", 10, 160, 5);
  return players;
}

describe("chooseCpuPick", () => {
  const teams = 8;
  const rosterSlots: RosterSlots = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 6 };
  const totalRounds = rosterSlotCount(rosterSlots);

  it("fills every team's dedicated roster needs and never exceeds position caps, across many seeds", () => {
    const pool = buildCpuTestPool();

    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      let picks: Pick[] = [];
      for (let overall = 1; overall <= teams * totalRounds; overall++) {
        const loc = locationForOverallPick(overall, teams);
        const draftedIds = new Set(picks.map((p) => p.playerId));
        const teamPicks = picks.filter((p) => p.teamSlot === loc.teamSlot);
        const chosen = chooseCpuPick(pool, draftedIds, teamPicks, rosterSlots, totalRounds, rng);
        expect(chosen).not.toBeNull();
        picks = applyAddPick(picks, chosen!.id, loc.teamSlot, teams);
      }

      const playerIds = picks.map((p) => p.playerId);
      expect(new Set(playerIds).size).toBe(playerIds.length); // no player drafted twice

      const playersById = new Map(pool.map((p) => [p.id, p]));
      for (let teamSlot = 1; teamSlot <= teams; teamSlot++) {
        const teamPicks = picks.filter((p) => p.teamSlot === teamSlot);
        const counts: Record<Player["position"], number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
        for (const pick of teamPicks) counts[playersById.get(pick.playerId)!.position]++;

        expect(counts.QB).toBeGreaterThanOrEqual(rosterSlots.QB);
        expect(counts.RB).toBeGreaterThanOrEqual(rosterSlots.RB);
        expect(counts.WR).toBeGreaterThanOrEqual(rosterSlots.WR);
        expect(counts.TE).toBeGreaterThanOrEqual(rosterSlots.TE);
        expect(counts.K).toBe(1); // exactly one kicker, never more
        expect(counts.DST).toBe(1); // exactly one defense, never more
        expect(counts.QB).toBeLessThanOrEqual(2);
        expect(counts.TE).toBeLessThanOrEqual(2);
      }
    }
  });

  it("introduces some randomness instead of always taking the literal best-ADP player", () => {
    const pool = buildCpuTestPool();
    const firstPicks = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed * 97 + 3);
      const chosen = chooseCpuPick(pool, new Set(), [], rosterSlots, totalRounds, rng);
      firstPicks.add(chosen!.id);
    }
    expect(firstPicks.size).toBeGreaterThan(1);
  });
});
