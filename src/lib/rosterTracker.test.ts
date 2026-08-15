import { describe, expect, it } from "vitest";
import { buildRosterState } from "./rosterTracker";
import type { Pick, Player, RosterSlots } from "./types";

function makePlayer(id: string, position: Player["position"], byeWeek: number | null = null): Player {
  return {
    id,
    name: id,
    team: "FA",
    position,
    byeWeek,
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

function makePick(overall: number, playerId: string): Pick {
  return { overall, round: overall, slotInRound: 1, teamSlot: 1, playerId, timestamp: new Date().toISOString(), corrected: false };
}

const DEFAULT_SLOTS: RosterSlots = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 0, K: 1, DST: 1, BENCH: 6, IR: 0 };

describe("buildRosterState — default no-FLEX lineup", () => {
  it("fills dedicated slots in draft order and leaves the rest as needs", () => {
    const players = new Map([
      ["qb1", makePlayer("qb1", "QB")],
      ["rb1", makePlayer("rb1", "RB")],
      ["rb2", makePlayer("rb2", "RB")]
    ]);
    const picks = [makePick(1, "qb1"), makePick(2, "rb1"), makePick(3, "rb2")];
    const state = buildRosterState(picks, players, DEFAULT_SLOTS);

    const qbSlot = state.slots.find((s) => s.category === "QB");
    expect(qbSlot?.player?.id).toBe("qb1");

    const rbSlots = state.slots.filter((s) => s.category === "RB");
    expect(rbSlots.map((s) => s.player?.id)).toEqual(["rb1", "rb2"]);

    const wrSlots = state.slots.filter((s) => s.category === "WR");
    expect(wrSlots.every((s) => s.player === null)).toBe(true);
  });

  it("overflows a 3rd RB straight to bench when there's no FLEX", () => {
    const players = new Map([
      ["rb1", makePlayer("rb1", "RB")],
      ["rb2", makePlayer("rb2", "RB")],
      ["rb3", makePlayer("rb3", "RB")]
    ]);
    const picks = [makePick(1, "rb1"), makePick(2, "rb2"), makePick(3, "rb3")];
    const state = buildRosterState(picks, players, DEFAULT_SLOTS);
    const bench = state.slots.filter((s) => s.category === "BENCH");
    expect(bench[0].player?.id).toBe("rb3");
  });
});

describe("buildRosterState — FLEX and SUPERFLEX", () => {
  it("sends a 3rd RB to FLEX when FLEX is configured", () => {
    const slots: RosterSlots = { ...DEFAULT_SLOTS, FLEX: 1 };
    const players = new Map([
      ["rb1", makePlayer("rb1", "RB")],
      ["rb2", makePlayer("rb2", "RB")],
      ["rb3", makePlayer("rb3", "RB")]
    ]);
    const picks = [makePick(1, "rb1"), makePick(2, "rb2"), makePick(3, "rb3")];
    const state = buildRosterState(picks, players, slots);
    const flex = state.slots.find((s) => s.category === "FLEX");
    expect(flex?.player?.id).toBe("rb3");
  });

  it("sends a 2nd QB to SUPERFLEX when configured, not to bench", () => {
    const slots: RosterSlots = { ...DEFAULT_SLOTS, SUPERFLEX: 1 };
    const players = new Map([
      ["qb1", makePlayer("qb1", "QB")],
      ["qb2", makePlayer("qb2", "QB")]
    ]);
    const picks = [makePick(1, "qb1"), makePick(2, "qb2")];
    const state = buildRosterState(picks, players, slots);
    const superflex = state.slots.find((s) => s.category === "SUPERFLEX");
    expect(superflex?.player?.id).toBe("qb2");
  });

  it("uses IR only after bench is full", () => {
    const slots: RosterSlots = { QB: 1, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, DST: 0, BENCH: 1, IR: 1 };
    const players = new Map([
      ["qb1", makePlayer("qb1", "QB")],
      ["qb2", makePlayer("qb2", "QB")],
      ["qb3", makePlayer("qb3", "QB")]
    ]);
    const picks = [makePick(1, "qb1"), makePick(2, "qb2"), makePick(3, "qb3")];
    const state = buildRosterState(picks, players, slots);
    expect(state.slots.find((s) => s.category === "BENCH")?.player?.id).toBe("qb2");
    expect(state.slots.find((s) => s.category === "IR")?.player?.id).toBe("qb3");
  });
});

describe("bye-stack warnings", () => {
  it("flags 3+ starters sharing a bye week", () => {
    const slots: RosterSlots = { QB: 1, RB: 1, WR: 1, TE: 1, FLEX: 0, K: 0, DST: 0, BENCH: 0 };
    const players = new Map([
      ["qb1", makePlayer("qb1", "QB", 9)],
      ["rb1", makePlayer("rb1", "RB", 9)],
      ["wr1", makePlayer("wr1", "WR", 9)],
      ["te1", makePlayer("te1", "TE", 5)]
    ]);
    const picks = [makePick(1, "qb1"), makePick(2, "rb1"), makePick(3, "wr1"), makePick(4, "te1")];
    const state = buildRosterState(picks, players, slots);
    expect(state.byeStackWarnings.some((w) => w.includes("bye week 9"))).toBe(true);
  });

  it("flags when both starting RBs share a bye, even with only 2 starters", () => {
    const slots: RosterSlots = { QB: 0, RB: 2, WR: 0, TE: 0, FLEX: 0, K: 0, DST: 0, BENCH: 0 };
    const players = new Map([
      ["rb1", makePlayer("rb1", "RB", 7)],
      ["rb2", makePlayer("rb2", "RB", 7)]
    ]);
    const picks = [makePick(1, "rb1"), makePick(2, "rb2")];
    const state = buildRosterState(picks, players, slots);
    expect(state.byeStackWarnings.some((w) => w.includes("All starting RBs"))).toBe(true);
  });

  it("does not warn on bench-only bye overlaps", () => {
    const slots: RosterSlots = { QB: 0, RB: 1, WR: 0, TE: 0, FLEX: 0, K: 0, DST: 0, BENCH: 2 };
    const players = new Map([
      ["rb1", makePlayer("rb1", "RB", 7)],
      ["rb2", makePlayer("rb2", "RB", 7)],
      ["rb3", makePlayer("rb3", "RB", 7)]
    ]);
    const picks = [makePick(1, "rb1"), makePick(2, "rb2"), makePick(3, "rb3")];
    const state = buildRosterState(picks, players, slots);
    expect(state.byeStackWarnings).toEqual([]);
  });
});
