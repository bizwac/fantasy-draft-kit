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
//
// WR deliberately uses --position-amber-ink (white) rather than the
// higher-contrast --accent-ink (dark) that amber gets everywhere else
// in the app — matching the white text on every other tile reads as
// more consistent as a set, even though white-on-amber alone tests
// lower contrast than dark-on-amber.
export const POSITION_TEXT_COLOR: Record<Position, string> = {
  QB: "var(--info-ink)",
  RB: "var(--success-ink)",
  WR: "var(--position-amber-ink)",
  TE: "var(--warning-ink)",
  K: "var(--neutral-ink)",
  DST: "var(--neutral-ink)"
};
