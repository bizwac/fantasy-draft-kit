import { describe, expect, it } from "vitest";
import { assignTiers, computeAuctionValues, computeVorp, replacementLevels, replacementRanks } from "./valueMetrics";
import { DEFAULT_ROSTER_SLOTS, type Player, type RosterSlots } from "./types";

function makePlayer(overrides: Partial<Player> & { id: string; position: Player["position"] }): Player {
  return {
    name: overrides.id,
    team: "FA",
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
    adp: null,
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
    lastUpdated: new Date().toISOString(),
    ...overrides
  };
}

describe("replacementRanks", () => {
  it("scales with team count for a no-FLEX league", () => {
    const slots: RosterSlots = { ...DEFAULT_ROSTER_SLOTS }; // 1QB/2RB/2WR/1TE/0FLEX/1K/1DST
    const ranks12 = replacementRanks(slots, 12);
    expect(ranks12.QB).toBe(12);
    expect(ranks12.RB).toBe(24);
    expect(ranks12.WR).toBe(24);
    expect(ranks12.TE).toBe(12);

    const ranks10 = replacementRanks(slots, 10);
    expect(ranks10.RB).toBe(20);
  });

  it("distributes FLEX demand across RB/WR/TE", () => {
    const slots: RosterSlots = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 3, K: 1, DST: 1, BENCH: 6 };
    const ranks = replacementRanks(slots, 12);
    // RB/WR: 2 dedicated + 3/3 FLEX share = 3 per team; TE: 1 dedicated + 1 = 2 per team
    expect(ranks.RB).toBe(36);
    expect(ranks.WR).toBe(36);
    expect(ranks.TE).toBe(24);
  });
});

describe("replacementLevels + computeVorp", () => {
  it("gives a player at exactly the replacement rank ~0 VORP", () => {
    const slots: RosterSlots = { QB: 1, RB: 1, WR: 1, TE: 1, FLEX: 0, K: 0, DST: 0, BENCH: 0 };
    const teams = 2; // replacement rank for RB = 2
    const players = [
      makePlayer({ id: "rb1", position: "RB", projPoints: 300 }),
      makePlayer({ id: "rb2", position: "RB", projPoints: 200 }),
      makePlayer({ id: "rb3", position: "RB", projPoints: 100 })
    ];
    const levels = replacementLevels(players, slots, teams);
    expect(levels.RB).toBe(200);

    const vorp = computeVorp(players, levels);
    expect(vorp.get("rb1")).toBe(100);
    expect(vorp.get("rb2")).toBe(0);
    expect(vorp.get("rb3")).toBe(-100);
  });

  it("omits players without projections", () => {
    const slots: RosterSlots = { ...DEFAULT_ROSTER_SLOTS };
    const players = [makePlayer({ id: "no-proj", position: "WR" })];
    const levels = replacementLevels(players, slots, 12);
    const vorp = computeVorp(players, levels);
    expect(vorp.has("no-proj")).toBe(false);
  });
});

describe("computeAuctionValues", () => {
  it("floors below-replacement draftable players at $1 and sums to roughly the budget pool", () => {
    const slots: RosterSlots = { QB: 0, RB: 1, WR: 0, TE: 0, FLEX: 0, K: 0, DST: 0, BENCH: 0 };
    const teams = 2; // pool size = 2, replacement rank = 2
    const players = [
      makePlayer({ id: "a", position: "RB", projPoints: 300 }),
      makePlayer({ id: "b", position: "RB", projPoints: 200 }),
      makePlayer({ id: "c", position: "RB", projPoints: 50 })
    ];
    const levels = replacementLevels(players, slots, teams);
    const vorp = computeVorp(players, levels);
    const values = computeAuctionValues(players, vorp, { teams, rosterSlots: slots, budget: 200 });

    // pool size = 2, so only top-2 VORP players get a value
    expect(values.size).toBe(2);
    expect(values.get("c")).toBeUndefined();
    // spendable = 400 - 2*1 = 398, all goes to "a" (only positive VORP)
    expect(values.get("a")).toBeCloseTo(1 + 398, 5);
    expect(values.get("b")).toBe(1);
  });
});

describe("assignTiers", () => {
  it("creates a new tier at a statistically large projection gap", () => {
    const players = [
      makePlayer({ id: "elite1", position: "WR", projPoints: 300 }),
      makePlayer({ id: "elite2", position: "WR", projPoints: 295 }),
      makePlayer({ id: "good1", position: "WR", projPoints: 200 }), // big drop -> new tier
      makePlayer({ id: "good2", position: "WR", projPoints: 195 }),
      makePlayer({ id: "good3", position: "WR", projPoints: 190 })
    ];
    const tiers = assignTiers(players);
    expect(tiers.get("elite1")?.tier).toBe(1);
    expect(tiers.get("elite2")?.tier).toBe(1);
    expect(tiers.get("good1")?.tier).toBeGreaterThan(1);
    expect(tiers.get("good1")?.basis).toBe("projection");
  });

  it("falls back to ADP when projections are largely missing", () => {
    const players = [
      makePlayer({ id: "p1", position: "TE", adp: 20 }),
      makePlayer({ id: "p2", position: "TE", adp: 25 }),
      makePlayer({ id: "p3", position: "TE", adp: 90 })
    ];
    const tiers = assignTiers(players);
    expect(tiers.get("p1")?.basis).toBe("adp");
  });
});
