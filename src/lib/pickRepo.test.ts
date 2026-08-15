import { describe, expect, it } from "vitest";
import { applyAddPick, applyCorrectPick, applyDeletePick, applyUndoLastPick } from "./pickRepo";
import { locationForOverallPick } from "./draftMath";
import type { Pick } from "./types";

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
