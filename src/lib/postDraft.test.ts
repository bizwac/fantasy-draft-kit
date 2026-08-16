import { describe, expect, it } from "vitest";
import { buildPostDraftGrid, computeReachesAndSteals, computeTeamProjections } from "./postDraft";
import type { Draft, Pick, Player, RosterSlots } from "./types";

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    team: "FA",
    position: "RB",
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

function makePick(overall: number, round: number, teamSlot: number, playerId: string): Pick {
  return { overall, round, slotInRound: 1, teamSlot, playerId, timestamp: new Date().toISOString(), corrected: false };
}

const SLOTS: RosterSlots = { QB: 1, RB: 1, WR: 0, TE: 0, FLEX: 0, K: 0, DST: 0, BENCH: 2 };

function makeDraft(picks: Pick[], teams = 2): Draft {
  return {
    id: "d1",
    name: "Test",
    createdAt: new Date().toISOString(),
    settings: {
      teams,
      scoring: "ppr",
      rosterSlots: SLOTS,
      snake: true,
      myDraftSlot: 1,
      teamNames: Array.from({ length: teams }, (_, i) => `Team ${i + 1}`)
    },
    picks,
    status: "live"
  };
}

describe("buildPostDraftGrid", () => {
  it("places each pick at [round-1][teamSlot-1]", () => {
    const p1 = makePlayer("p1");
    const p2 = makePlayer("p2");
    const draft = makeDraft([makePick(1, 1, 1, "p1"), makePick(2, 1, 2, "p2")]);
    const grid = buildPostDraftGrid(draft, new Map([["p1", p1], ["p2", p2]]));
    expect(grid.grid[0][0].player?.id).toBe("p1");
    expect(grid.grid[0][1].player?.id).toBe("p2");
  });

  it("leaves cells empty for a partial draft", () => {
    const p1 = makePlayer("p1");
    const draft = makeDraft([makePick(1, 1, 1, "p1")]);
    const grid = buildPostDraftGrid(draft, new Map([["p1", p1]]));
    expect(grid.grid[0][1].player).toBeNull();
  });
});

describe("computeTeamProjections", () => {
  it("returns null when no picks have projections", () => {
    const p1 = makePlayer("p1", { position: "QB" });
    const draft = makeDraft([makePick(1, 1, 1, "p1")]);
    expect(computeTeamProjections(draft, new Map([["p1", p1]]))).toBeNull();
  });

  it("sums only starter projections (bench doesn't count), ranked highest first", () => {
    // Team 1: qb1 (QB starter, 300) + rb1 (RB starter, 200) = 500
    // Team 2: qb2 (QB starter, 50) + rb2 (RB starter, 10) + rb3 (bench, 999 — must NOT count)
    const players = new Map([
      ["qb1", makePlayer("qb1", { position: "QB", projPoints: 300 })],
      ["rb1", makePlayer("rb1", { position: "RB", projPoints: 200 })],
      ["qb2", makePlayer("qb2", { position: "QB", projPoints: 50 })],
      ["rb2", makePlayer("rb2", { position: "RB", projPoints: 10 })],
      ["rb3", makePlayer("rb3", { position: "RB", projPoints: 999 })]
    ]);
    const draft = makeDraft([
      makePick(1, 1, 1, "qb1"),
      makePick(2, 1, 2, "qb2"),
      makePick(3, 2, 2, "rb2"),
      makePick(4, 2, 1, "rb1"),
      makePick(5, 3, 2, "rb3")
    ]);
    const projections = computeTeamProjections(draft, players);
    expect(projections).not.toBeNull();
    expect(projections![0]).toMatchObject({ teamSlot: 1, starterPoints: 500 });
    expect(projections![1]).toMatchObject({ teamSlot: 2, starterPoints: 60 });
  });
});

describe("computeReachesAndSteals", () => {
  it("flags a player taken after their ADP as a steal (positive value)", () => {
    const p1 = makePlayer("p1", { adp: 5 });
    const draft = makeDraft([makePick(20, 2, 1, "p1")], 1);
    // teams=1 forces round math irrelevant here; overall=20 stands in for pick number
    const summary = computeReachesAndSteals(draft, new Map([["p1", p1]]));
    expect(summary[0].picks[0].valueVsAdp).toBe(20 - 5);
  });

  it("skips picks for players without ADP", () => {
    const p1 = makePlayer("p1", { adp: null });
    const draft = makeDraft([makePick(1, 1, 1, "p1")]);
    const summary = computeReachesAndSteals(draft, new Map([["p1", p1]]));
    expect(summary.find((s) => s.teamSlot === 1)?.picks).toEqual([]);
  });
});
