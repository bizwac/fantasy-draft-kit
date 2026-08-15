import { describe, expect, it } from "vitest";
import { locationForOverallPick, nextPickForSlot, onTheClock, overallPickFor, picksForSlot } from "./draftMath";

describe("locationForOverallPick", () => {
  it("keeps round 1 in forward order", () => {
    expect(locationForOverallPick(1, 12).teamSlot).toBe(1);
    expect(locationForOverallPick(12, 12).teamSlot).toBe(12);
  });

  it("reverses round 2 (the snake turn)", () => {
    expect(locationForOverallPick(13, 12).teamSlot).toBe(12);
    expect(locationForOverallPick(24, 12).teamSlot).toBe(1);
  });

  it("alternates correctly across many rounds for 8/10/12/14 teams", () => {
    for (const teams of [8, 10, 12, 14]) {
      for (let round = 1; round <= 16; round++) {
        const forward = round % 2 === 1;
        const firstPickOfRound = locationForOverallPick((round - 1) * teams + 1, teams);
        const lastPickOfRound = locationForOverallPick(round * teams, teams);
        expect(firstPickOfRound.teamSlot).toBe(forward ? 1 : teams);
        expect(lastPickOfRound.teamSlot).toBe(forward ? teams : 1);
        expect(firstPickOfRound.round).toBe(round);
        expect(lastPickOfRound.round).toBe(round);
      }
    }
  });
});

describe("overallPickFor / locationForOverallPick round-trip", () => {
  it("is a perfect inverse for every slot and round", () => {
    for (const teams of [8, 10, 12, 14]) {
      for (let round = 1; round <= 16; round++) {
        for (let slot = 1; slot <= teams; slot++) {
          const overall = overallPickFor(round, slot, teams);
          const loc = locationForOverallPick(overall, teams);
          expect(loc.round).toBe(round);
          expect(loc.teamSlot).toBe(slot);
        }
      }
    }
  });
});

describe("picksForSlot / nextPickForSlot", () => {
  it("gives slot 1 the first pick of every odd round and last of every even round (12 teams)", () => {
    const picks = picksForSlot(1, 12, 4);
    expect(picks).toEqual([1, 24, 25, 48]);
  });

  it("gives the last slot the mirror pattern", () => {
    const picks = picksForSlot(12, 12, 4);
    expect(picks).toEqual([12, 13, 36, 37]);
  });

  it("nextPickForSlot advances as picks are made", () => {
    expect(nextPickForSlot(5, 12, 15, 0)).toBe(5);
    expect(nextPickForSlot(5, 12, 15, 4)).toBe(5);
    expect(nextPickForSlot(5, 12, 15, 5)).toBe(20); // round 2 reversal: slot 5 -> pick 20
    expect(nextPickForSlot(5, 12, 15, 19)).toBe(20);
    expect(nextPickForSlot(5, 12, 15, 20)).toBe(29); // round 3 back to forward order
  });

  it("returns null once the slot's picks are exhausted", () => {
    expect(nextPickForSlot(1, 12, 2, 24)).toBeNull();
  });
});

describe("onTheClock", () => {
  it("matches locationForOverallPick(picksMade + 1)", () => {
    expect(onTheClock(0, 10)).toEqual(locationForOverallPick(1, 10));
    expect(onTheClock(23, 10)).toEqual(locationForOverallPick(24, 10));
  });
});
