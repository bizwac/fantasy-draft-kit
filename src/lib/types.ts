export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export interface PlayerUsage {
  snapPct: number | null;
  targetShare: number | null;
  rzTouches: number | null;
  season: number | null;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: Position;
  byeWeek: number | null;
  injuryStatus: string | null;
  isRookie: boolean;
  contractYear: boolean | null;
  teamWinningRecordLastYear: boolean | null;
  teamProjectedWinning: boolean | null;
  winningTeam: boolean | null;
  depthChartOrder: number | null;
  depthChartPos: string | null;
  handcuffOfPlayerId: string | null;

  adp: number | null;
  adpStdDev: number | null;
  projPoints: number | null;
  positionRank: number | null;
  overallRank: number | null;
  tier: number | null;
  vorp: number | null;
  auctionValue: number | null;
  sosSeason: number | null;
  sosPlayoffs: number | null;
  usage: PlayerUsage | null;
  trendingAddCount: number | null;
  lastUpdated: string;
}

export interface PersonalOverride {
  playerId: string;
  customRank: number | null;
  favorite: boolean;
  doNotDraft: boolean;
  note: string | null;
}

export type ScoringFormat = "ppr" | "half" | "std" | "superflex-ppr";

export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX?: number;
  K: number;
  DST: number;
  BENCH: number;
  IR?: number;
}

export interface DraftSettings {
  teams: number;
  scoring: ScoringFormat;
  rosterSlots: RosterSlots;
  snake: true;
  myDraftSlot: number;
  teamNames: string[];
}

export interface Pick {
  overall: number;
  round: number;
  slotInRound: number;
  teamSlot: number;
  playerId: string;
  timestamp: string;
  corrected: boolean;
}

export type DraftStatus = "setup" | "live" | "complete";

export interface Draft {
  id: string;
  name: string;
  createdAt: string;
  settings: DraftSettings;
  picks: Pick[];
  status: DraftStatus;
  // Controls only whether the on-the-clock countdown (see timerSettings)
  // is actively ticking — separate from `status`, which tracks the draft
  // itself. Lives on the draft record (not localStorage) specifically so
  // Start/Pause reaches every view showing this draft, including a Live
  // View on another device, through the same sync path as picks.
  // Undefined (a draft created before this field existed, or a fresh one
  // not yet started) behaves as not-running.
  timerRunning?: boolean;
}

export const DEFAULT_ROSTER_SLOTS: RosterSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 0,
  K: 1,
  DST: 1,
  BENCH: 6,
  IR: 0
};

export function createDefaultDraftSettings(): DraftSettings {
  return {
    teams: 12,
    scoring: "ppr",
    rosterSlots: { ...DEFAULT_ROSTER_SLOTS },
    snake: true,
    myDraftSlot: 1,
    teamNames: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`)
  };
}
