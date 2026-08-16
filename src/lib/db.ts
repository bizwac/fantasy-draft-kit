import Dexie, { type Table } from "dexie";
import type { Draft, HuddlePlayerIndexEntry, PersonalOverride, Player, PlayerSeasonStats } from "./types";

class FadeSignalDB extends Dexie {
  players!: Table<Player, string>;
  personalRankings!: Table<PersonalOverride, string>;
  drafts!: Table<Draft, string>;
  seasonStats!: Table<PlayerSeasonStats, string>;
  huddlePlayers!: Table<HuddlePlayerIndexEntry, string>;

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
    // seasonStats is its own store, not a field on Player, specifically
    // so refreshPlayerData's clear-and-rebuild of `players` (run
    // automatically every 24h) can never wipe it out from under a user.
    this.version(2).stores({
      seasonStats: "playerId"
    });
    // Maps a normalized player name to TheHuddle's own numeric player ID
    // (needed to link to their per-player news page — see huddlePlayers.ts).
    this.version(3).stores({
      huddlePlayers: "nameKey"
    });
  }
}

export const db = new FadeSignalDB();
