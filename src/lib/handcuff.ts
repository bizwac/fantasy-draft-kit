import type { Player, Position } from "./types";

const HANDCUFF_POSITIONS: Position[] = ["RB", "WR", "TE"];

// Links each backup to the starter above him on the same team's depth
// chart (spec §4.20) — derived from Sleeper's depth_chart_order, never
// stored, so it's always consistent with whatever the last refresh
// loaded. Depth data is noisiest in preseason (spec's own caveat), so
// this is presented as an estimate, not a guarantee.
export function computeHandcuffs(players: Player[]): Map<string, string> {
  const handcuffOfPlayerId = new Map<string, string>();

  const groups = new Map<string, Player[]>();
  for (const p of players) {
    if (!HANDCUFF_POSITIONS.includes(p.position)) continue;
    if (p.depthChartOrder === null || p.team === "FA") continue;
    const key = `${p.team}|${p.position}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => (a.depthChartOrder as number) - (b.depthChartOrder as number));
    const starter = group[0];
    if (starter.depthChartOrder !== 1) continue;
    for (let i = 1; i < group.length; i++) {
      handcuffOfPlayerId.set(group[i].id, starter.id);
    }
  }

  return handcuffOfPlayerId;
}

export function depthChartLabel(player: Player): string | null {
  if (player.depthChartOrder === null) return null;
  const pos = player.depthChartPos ?? player.position;
  return `${pos}${player.depthChartOrder} on ${player.team}`;
}
