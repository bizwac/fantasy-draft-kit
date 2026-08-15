import { describe, expect, it } from "vitest";
import {
  FfcAdpResponseSchema,
  SleeperPlayerRawSchema,
  SleeperPlayersResponseSchema,
  SleeperTrendingResponseSchema
} from "./schema";

// Spec §7b.2: "Validate API responses from Sleeper/FFCalc before writing
// to the store — check shape and types... fail soft on garbage
// responses." These confirm the validation layer actually rejects
// garbage instead of the normalizers finding out the hard way.

describe("SleeperPlayerRawSchema", () => {
  it("accepts a real-shaped player record", () => {
    const result = SleeperPlayerRawSchema.safeParse({
      player_id: "4034",
      full_name: "Bijan Robinson",
      team: "ATL",
      position: "RB",
      years_exp: 2
    });
    expect(result.success).toBe(true);
  });

  it("rejects a record missing the required player_id", () => {
    const result = SleeperPlayerRawSchema.safeParse({ full_name: "No ID Guy" });
    expect(result.success).toBe(false);
  });

  it("rejects completely garbage shapes without throwing", () => {
    for (const garbage of [null, undefined, "a string", 42, [], true]) {
      expect(() => SleeperPlayerRawSchema.safeParse(garbage)).not.toThrow();
      expect(SleeperPlayerRawSchema.safeParse(garbage).success).toBe(false);
    }
  });
});

describe("SleeperPlayersResponseSchema (the top-level dump)", () => {
  it("accepts any object — per-player validity is checked one record at a time downstream", () => {
    expect(SleeperPlayersResponseSchema.safeParse({ "4034": { anything: "goes here" } }).success).toBe(true);
  });

  it("rejects a non-object top level (e.g. an HTML error page parsed as JSON would not even get this far, but an array/string response should still be caught)", () => {
    expect(SleeperPlayersResponseSchema.safeParse(["not", "an", "object"]).success).toBe(false);
    expect(SleeperPlayersResponseSchema.safeParse("error page text").success).toBe(false);
  });
});

describe("SleeperTrendingResponseSchema", () => {
  it("rejects entries missing count", () => {
    const result = SleeperTrendingResponseSchema.safeParse([{ player_id: "1" }]);
    expect(result.success).toBe(false);
  });
});

describe("FfcAdpResponseSchema", () => {
  it("accepts a real-shaped response", () => {
    const result = FfcAdpResponseSchema.safeParse({
      status: "Success",
      players: [{ player_id: 1, name: "Bijan Robinson", position: "RB", adp: 1.7 }]
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response with a malformed players array (e.g. a proxy error body)", () => {
    const result = FfcAdpResponseSchema.safeParse({ error: "upstream timeout" });
    expect(result.success).toBe(false);
  });

  it("rejects a player entry missing required numeric adp", () => {
    const result = FfcAdpResponseSchema.safeParse({
      players: [{ player_id: 1, name: "No ADP Guy", position: "RB" }]
    });
    expect(result.success).toBe(false);
  });
});
