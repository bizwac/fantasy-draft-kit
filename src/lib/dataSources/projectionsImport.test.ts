import { describe, expect, it } from "vitest";
import { matchProjectionRows } from "./projectionsImport";
import type { MappedProjectionRow } from "./csvImport";
import type { Player } from "../types";

function makePlayer(id: string, name: string, team: string, position: Player["position"]): Player {
  return {
    id,
    name,
    team,
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
    lastUpdated: new Date().toISOString()
  };
}

function makeRow(overrides: Partial<MappedProjectionRow> & { name: string }): MappedProjectionRow {
  return {
    team: null,
    position: null,
    projPoints: null,
    contractYear: null,
    teamWinningRecordLastYear: null,
    teamProjectedWinning: null,
    sosSeason: null,
    sosPlayoffs: null,
    snapPct: null,
    targetShare: null,
    rzTouches: null,
    ...overrides
  };
}

describe("matchProjectionRows", () => {
  it("matches by name+team when two players share a name across teams", () => {
    const players = [makePlayer("p1", "Michael Thomas", "NO", "WR"), makePlayer("p2", "Michael Thomas", "HOU", "WR")];
    const rows = [makeRow({ name: "Michael Thomas", team: "HOU", projPoints: 150 })];

    const { updates, unmatched } = matchProjectionRows(rows, players);

    expect(unmatched).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("p2");
    expect(updates[0].projPoints).toBe(150);
  });

  it("matches by name+position when two players share a name across positions", () => {
    const players = [makePlayer("p1", "Josh Allen", "BUF", "QB"), makePlayer("p2", "Josh Allen", "JAC", "RB")];
    const rows = [makeRow({ name: "Josh Allen", position: "RB", projPoints: 90 })];

    const { updates, unmatched } = matchProjectionRows(rows, players);

    expect(unmatched).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("p2");
  });

  it("prefers the combined name+team+position match when both are mapped", () => {
    const players = [
      makePlayer("p1", "Josh Allen", "BUF", "QB"),
      makePlayer("p2", "Josh Allen", "JAC", "RB"),
      makePlayer("p3", "Josh Allen", "JAC", "TE")
    ];
    const rows = [makeRow({ name: "Josh Allen", team: "JAC", position: "RB", projPoints: 90 })];

    const { updates, unmatched } = matchProjectionRows(rows, players);

    expect(unmatched).toEqual([]);
    expect(updates[0].id).toBe("p2");
  });

  it("leaves an ambiguous name unmatched when neither team nor position is mapped", () => {
    const players = [makePlayer("p1", "Michael Thomas", "NO", "WR"), makePlayer("p2", "Michael Thomas", "HOU", "WR")];
    const rows = [makeRow({ name: "Michael Thomas", projPoints: 150 })];

    const { updates, unmatched } = matchProjectionRows(rows, players);

    expect(updates).toEqual([]);
    expect(unmatched).toEqual(["Michael Thomas"]);
  });

  it("still matches an unambiguous name with no team/position mapped", () => {
    const players = [makePlayer("p1", "Christian McCaffrey", "SF", "RB")];
    const rows = [makeRow({ name: "Christian McCaffrey", projPoints: 300 })];

    const { updates, unmatched } = matchProjectionRows(rows, players);

    expect(unmatched).toEqual([]);
    expect(updates[0].id).toBe("p1");
  });

  it("never overwrites the matched player's own team, position, or name", () => {
    const players = [makePlayer("p1", "Michael Thomas", "NO", "WR")];
    const rows = [makeRow({ name: "Michael Thomas", team: "NO", position: "WR", projPoints: 150 })];

    const { updates } = matchProjectionRows(rows, players);

    expect(updates[0].team).toBe("NO");
    expect(updates[0].position).toBe("WR");
    expect(updates[0].name).toBe("Michael Thomas");
  });

  it("only applies the fields the CSV actually mapped, leaving the rest untouched", () => {
    const base = { ...makePlayer("p1", "CeeDee Lamb", "DAL", "WR"), contractYear: true, sosSeason: 5 };
    const rows = [makeRow({ name: "CeeDee Lamb", team: "DAL", projPoints: 275 })];

    const { updates } = matchProjectionRows(rows, [base]);

    expect(updates[0].projPoints).toBe(275);
    expect(updates[0].contractYear).toBe(true); // untouched, not mapped in this row
    expect(updates[0].sosSeason).toBe(5); // untouched, not mapped in this row
  });
});
