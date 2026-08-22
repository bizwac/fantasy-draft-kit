// Pos and Player are always shown, always lead the row, and stay pinned
// in place (sticky) during horizontal scroll — every other column is
// configurable (order + visibility) via Settings, laid out at a fixed
// width and reached by scrolling the table sideways rather than being
// hidden below a breakpoint (the previous mobileOnly behavior — narrow
// screens couldn't reach those columns at all, and the ones that did
// show got squeezed instead). Shared between PlayerRow and
// PlayerListHeader so header labels always line up with the data
// underneath.
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
}

export const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  injury: { key: "injury", label: "Inj", settingsLabel: "Injury Status", title: "Injury status", widthClass: "w-8" },
  adp: { key: "adp", label: "ADP", settingsLabel: "ADP", widthClass: "w-14" },
  rank: { key: "rank", label: "Rk", settingsLabel: "Overall Rank", title: "Overall rank", widthClass: "w-10" },
  bye: { key: "bye", label: "Bye", settingsLabel: "Bye Week", widthClass: "w-10" },
  rookie: { key: "rookie", label: "R", settingsLabel: "Rookie", title: "Rookie", widthClass: "w-6" },
  team: { key: "team", label: "Team", settingsLabel: "Team", widthClass: "w-12" },
  tier: { key: "tier", label: "Tier", settingsLabel: "Tier", widthClass: "w-10" },
  value: { key: "value", label: "$", settingsLabel: "Auction Value", title: "Estimated auction value", widthClass: "w-12" },
  draftedBy: { key: "draftedBy", label: "Drafted", settingsLabel: "Drafted By", widthClass: "w-24" },
  lastSeasonPts: {
    key: "lastSeasonPts",
    label: "L Pts",
    settingsLabel: "Last Season Points",
    title: "Fantasy points, most recent completed season",
    widthClass: "w-14"
  },
  projPoints: {
    key: "projPoints",
    label: "Proj",
    settingsLabel: "Projected Points",
    title: "Projected fantasy points, this season",
    widthClass: "w-14"
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
  return [def.widthClass, "shrink-0"].join(" ");
}
