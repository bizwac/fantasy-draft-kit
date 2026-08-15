import type { Position } from "./types";

export const POSITION_COLOR: Record<Position, string> = {
  QB: "var(--info)",
  RB: "var(--success)",
  WR: "var(--accent)",
  TE: "var(--warning)",
  K: "var(--text-secondary)",
  DST: "var(--text-secondary)"
};
