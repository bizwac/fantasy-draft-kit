// Pos and Player are always shown and always lead the row — every other
// column is configurable (order + visibility) via Settings. Shared
// between PlayerRow and PlayerListHeader so header labels always line up
// with the data underneath: every visible column reserves the same width
// in both places, rather than only appearing when a given row happens to
// have that value (which is what silently drifted columns out of
// alignment before this became data-driven).
export type ColumnKey =
  | "injury"
  | "adp"
  | "rank"
  | "bye"
  | "rookie"
  | "team"
  | "tier"
  | "value"
  | "draftedBy"
  | "lastSeasonPts"
  | "projPoints";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  settingsLabel: string;
  title?: string;
  widthClass: string;
  mobileOnly?: boolean;
}

export const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  injury: { key: "injury", label: "Inj", settingsLabel: "Injury Status", title: "Injury status", widthClass: "w-6 sm:w-8" },
  adp: { key: "adp", label: "ADP", settingsLabel: "ADP", widthClass: "w-11 sm:w-14" },
  rank: { key: "rank", label: "Rk", settingsLabel: "Overall Rank", title: "Overall rank", widthClass: "w-10" },
  bye: { key: "bye", label: "Bye", settingsLabel: "Bye Week", widthClass: "w-8 sm:w-10" },
  rookie: { key: "rookie", label: "R", settingsLabel: "Rookie", title: "Rookie", widthClass: "w-5", mobileOnly: true },
  team: { key: "team", label: "Team", settingsLabel: "Team", widthClass: "w-12", mobileOnly: true },
  tier: { key: "tier", label: "Tier", settingsLabel: "Tier", widthClass: "w-8", mobileOnly: true },
  value: { key: "value", label: "$", settingsLabel: "Auction Value", title: "Estimated auction value", widthClass: "w-12", mobileOnly: true },
  draftedBy: { key: "draftedBy", label: "Drafted", settingsLabel: "Drafted By", widthClass: "w-24", mobileOnly: true },
  lastSeasonPts: {
    key: "lastSeasonPts",
    label: "L Pts",
    settingsLabel: "Last Season Points",
    title: "Fantasy points, most recent completed season",
    widthClass: "w-14",
    mobileOnly: true
  },
  projPoints: {
    key: "projPoints",
    label: "Proj",
    settingsLabel: "Projected Points",
    title: "Projected fantasy points, this season",
    widthClass: "w-14",
    mobileOnly: true
  }
};

export const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "injury",
  "adp",
  "rank",
  "bye",
  "rookie",
  "team",
  "tier",
  "value",
  "lastSeasonPts",
  "projPoints",
  "draftedBy"
];

export function columnWrapperClass(def: ColumnDef): string {
  return [def.mobileOnly ? "hidden lg:inline" : "", def.widthClass, "shrink-0"].filter(Boolean).join(" ");
}
