import type { Position } from "@/lib/types";

// K/DST are intentionally smaller/muted — spec §4.5: "Don't let K/DST
// clutter the signal — de-emphasize them."
const PROMINENT: Position[] = ["QB", "RB", "WR", "TE"];
const MUTED: Position[] = ["K", "DST"];

export default function ScarcityMeter({ counts }: { counts: Record<Position, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Positional scarcity — quality players remaining above replacement level">
      {PROMINENT.map((pos) => (
        <Chip key={pos} position={pos} count={counts[pos]} />
      ))}
      <span className="w-px self-stretch bg-border mx-1" aria-hidden />
      {MUTED.map((pos) => (
        <Chip key={pos} position={pos} count={counts[pos]} muted />
      ))}
    </div>
  );
}

function Chip({ position, count, muted }: { position: Position; count: number; muted?: boolean }) {
  const low = count <= 2;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium tabular-nums",
        muted ? "bg-surface-sunken text-text-secondary" : "bg-surface-sunken text-text-primary",
        low && !muted ? "text-danger" : ""
      ].join(" ")}
      title={`${count} ${position} remaining above replacement level`}
    >
      {position} <span className="font-semibold">{count}</span>
    </span>
  );
}
