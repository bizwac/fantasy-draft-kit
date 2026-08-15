import type { Position } from "./types";

export const POSITION_COLOR: Record<Position, string> = {
  QB: "var(--info)",
  RB: "var(--success)",
  WR: "var(--accent)",
  TE: "var(--warning)",
  K: "var(--neutral)",
  DST: "var(--neutral)"
};

// Only --accent-ink (used for WR's amber tile) was ever readable — every
// other position tile hardcoded that same dark-ink text on top of its
// own medium/dark fill. Each fill now has its own contrasting pairing
// (see tokens.css), so text stays readable in both themes.
export const POSITION_TEXT_COLOR: Record<Position, string> = {
  QB: "var(--info-ink)",
  RB: "var(--success-ink)",
  WR: "var(--accent-ink)",
  TE: "var(--warning-ink)",
  K: "var(--neutral-ink)",
  DST: "var(--neutral-ink)"
};
