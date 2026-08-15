import type { Player } from "@/lib/types";

const POSITION_COLOR: Record<Player["position"], string> = {
  QB: "var(--info)",
  RB: "var(--success)",
  WR: "var(--accent)",
  TE: "var(--warning)",
  K: "var(--text-secondary)",
  DST: "var(--text-secondary)"
};

export default function PlayerRow({
  player,
  drafted,
  draftedByLabel,
  onSelect
}: {
  player: Player;
  drafted: boolean;
  draftedByLabel: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={drafted}
      onClick={onSelect}
      className={[
        "w-full flex items-center gap-3 px-4 min-h-touch text-left border-b border-border transition-colors",
        drafted ? "opacity-40" : "hover:bg-surface-sunken active:bg-surface-sunken"
      ].join(" ")}
    >
      <span
        className="text-xs font-semibold w-9 shrink-0 text-center rounded px-1 py-0.5"
        style={{ backgroundColor: POSITION_COLOR[player.position], color: "var(--accent-ink)" }}
      >
        {player.position}
      </span>
      <span className={["flex-1 min-w-0 truncate font-medium", drafted ? "line-through" : ""].join(" ")}>
        {player.name}
      </span>
      <span className="text-sm text-text-secondary w-12 shrink-0">{player.team}</span>
      {player.injuryStatus && (
        <span className="text-xs font-semibold text-danger w-8 shrink-0" title={player.injuryStatus}>
          {player.injuryStatus.slice(0, 1)}
        </span>
      )}
      <span className="text-sm text-text-secondary w-14 shrink-0 tabular-nums">
        {player.adp !== null ? player.adp.toFixed(1) : "—"}
      </span>
      <span className="text-sm text-text-secondary w-10 shrink-0 tabular-nums">
        {player.byeWeek ?? "—"}
      </span>
      {drafted && draftedByLabel && (
        <span className="text-xs text-text-secondary w-24 shrink-0 truncate">{draftedByLabel}</span>
      )}
    </button>
  );
}
