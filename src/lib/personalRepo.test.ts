import { describe, expect, it } from "vitest";
import { mergeOverride } from "./personalRepo";
import type { PersonalOverride } from "./types";

const empty: PersonalOverride = { playerId: "p1", customRank: null, favorite: false, doNotDraft: false, note: null };

describe("mergeOverride", () => {
  it("keeps existing fields when the incoming record omits them", () => {
    const current: PersonalOverride = { playerId: "p1", customRank: 5, favorite: true, doNotDraft: false, note: "watch him" };
    const merged = mergeOverride(current, { playerId: "p1" });
    expect(merged).toEqual(current);
  });

  it("overwrites only the fields the incoming record sets", () => {
    const current: PersonalOverride = { playerId: "p1", customRank: 5, favorite: true, doNotDraft: false, note: "old note" };
    const merged = mergeOverride(current, { playerId: "p1", note: "new note" });
    expect(merged.note).toBe("new note");
    expect(merged.customRank).toBe(5);
    expect(merged.favorite).toBe(true);
  });

  it("never leaves both favorite and doNotDraft true — incoming favorite wins", () => {
    const current: PersonalOverride = { ...empty, doNotDraft: true };
    const merged = mergeOverride(current, { playerId: "p1", favorite: true });
    expect(merged.favorite).toBe(true);
    expect(merged.doNotDraft).toBe(false);
  });

  it("never leaves both true — incoming doNotDraft wins when it's the one being set", () => {
    const current: PersonalOverride = { ...empty, favorite: true };
    const merged = mergeOverride(current, { playerId: "p1", doNotDraft: true });
    expect(merged.doNotDraft).toBe(true);
    expect(merged.favorite).toBe(false);
  });

  it("does not corrupt a record where the incoming payload sets neither flag", () => {
    const current: PersonalOverride = { ...empty, favorite: true };
    const merged = mergeOverride(current, { playerId: "p1", note: "just a note update" });
    expect(merged.favorite).toBe(true);
    expect(merged.doNotDraft).toBe(false);
  });
});
