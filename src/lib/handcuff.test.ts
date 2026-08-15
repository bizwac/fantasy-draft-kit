import { describe, expect, it } from "vitest";
import { computeHandcuffs, depthChartLabel } from "./handcuff";
import type { Player } from "./types";

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    team: "ATL",
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

describe("computeHandcuffs", () => {
  it("links the RB2 to the RB1 on the same team", () => {
    const starter = makePlayer("bijan", { team: "ATL", position: "RB", depthChartOrder: 1 });
    const backup = makePlayer("allgeier", { team: "ATL", position: "RB", depthChartOrder: 2 });
    const other = makePlayer("other", { team: "DAL", position: "RB", depthChartOrder: 1 });

    const map = computeHandcuffs([starter, backup, other]);
    expect(map.get("allgeier")).toBe("bijan");
    expect(map.has("bijan")).toBe(false);
    expect(map.has("other")).toBe(false);
  });

  it("ignores free agents and players without depth chart data", () => {
    const fa = makePlayer("fa", { team: "FA", depthChartOrder: 1 });
    const noDepth = makePlayer("nodepth", { team: "ATL", depthChartOrder: null });
    const map = computeHandcuffs([fa, noDepth]);
    expect(map.size).toBe(0);
  });

  it("skips a group with no true starter (missing order 1)", () => {
    const two = makePlayer("two", { team: "ATL", position: "RB", depthChartOrder: 2 });
    const three = makePlayer("three", { team: "ATL", position: "RB", depthChartOrder: 3 });
    const map = computeHandcuffs([two, three]);
    expect(map.size).toBe(0);
  });
});

describe("depthChartLabel", () => {
  it("formats as POS# on TEAM", () => {
    const p = makePlayer("p", { team: "DAL", position: "WR", depthChartPos: "WR", depthChartOrder: 2 });
    expect(depthChartLabel(p)).toBe("WR2 on DAL");
  });

  it("returns null when depth data is missing", () => {
    expect(depthChartLabel(makePlayer("p"))).toBeNull();
  });
});
