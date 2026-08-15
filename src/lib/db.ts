import Dexie, { type Table } from "dexie";
import type { Draft, PersonalOverride, Player } from "./types";

class FadeSignalDB extends Dexie {
  players!: Table<Player, string>;
  personalRankings!: Table<PersonalOverride, string>;
  drafts!: Table<Draft, string>;

  constructor() {
    super("fade-signal");
    // Index only fields we actually query by; everything else is read
    // whole-record. Picks live inside `drafts` (append-only log) so board
    // state can always be re-derived instead of stored redundantly.
    this.version(1).stores({
      players: "id, position, team, adp, tier",
      personalRankings: "playerId, favorite, doNotDraft",
      drafts: "id, status, createdAt"
    });
  }
}

export const db = new FadeSignalDB();
