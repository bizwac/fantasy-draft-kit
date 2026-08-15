import type { Player } from "@/lib/types";
import { depthChartLabel } from "@/lib/handcuff";
import Badge from "./Badge";

export default function PlayerDetailCard({
  player,
  tier,
  tierBasis,
  vorp,
  auctionValue,
  handcuff,
  draftedByLabel,
  onClose
}: {
  player: Player;
  tier: number | null;
  tierBasis: "projection" | "adp" | null;
  vorp: number | null;
  auctionValue: number | null;
  handcuff: Player | null;
  draftedByLabel: string | null;
  onClose: () => void;
}) {
  const depthLabel = depthChartLabel(player);

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose} role="presentation">
      <div
        className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} details`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wide">
              {player.position} · {player.team}
              {player.byeWeek ? ` · Bye ${player.byeWeek}` : ""}
            </p>
            <h2 className="font-display text-2xl font-semibold">{player.name}</h2>
          </div>
          <button type="button" className="btn-secondary text-sm shrink-0" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {player.injuryStatus && <Badge tone="danger">{player.injuryStatus}</Badge>}
          {player.isRookie && <Badge tone="info">Rookie</Badge>}
          {player.contractYear && <Badge tone="warning">Contract Year</Badge>}
          {player.winningTeam && <Badge tone="success">Winning Team</Badge>}
          {draftedByLabel && <Badge tone="neutral">Drafted by {draftedByLabel}</Badge>}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="ADP" value={player.adp !== null ? player.adp.toFixed(1) : "—"} />
          <Stat label="Overall" value={player.overallRank ?? "—"} />
          <Stat label={`${player.position} Rank`} value={player.positionRank ?? "—"} />
          <Stat label="Tier" value={tier !== null ? `${tier}${tierBasis === "adp" ? " (ADP est.)" : ""}` : "—"} />
          <Stat label="VORP" value={vorp !== null ? vorp.toFixed(1) : "—"} />
          <Stat label="$ Value" value={auctionValue !== null ? `$${Math.round(auctionValue)}` : "—"} />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <Row label="Projection" value={player.projPoints !== null ? player.projPoints.toFixed(1) : "Not imported"} />
          <Row label="Depth chart" value={depthLabel ?? "Unknown (preseason estimate)"} />
          {handcuff && <Row label="Handcuff" value={handcuff.name} />}
          <Row
            label="Strength of schedule"
            value={
              player.sosSeason !== null || player.sosPlayoffs !== null
                ? `Season ${player.sosSeason ?? "—"} · Playoffs (wk 15–17) ${player.sosPlayoffs ?? "—"}`
                : "Not imported"
            }
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-secondary mb-1.5">Usage</h3>
          {player.isRookie && !player.usage ? (
            <p className="text-sm text-text-secondary italic">Rookie — no NFL history. Lean on projection and draft capital.</p>
          ) : player.usage ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Snap %" value={player.usage.snapPct !== null ? `${player.usage.snapPct}%` : "—"} />
              <Stat label="Target Share" value={player.usage.targetShare !== null ? `${player.usage.targetShare}%` : "—"} />
              <Stat label="RZ Touches" value={player.usage.rzTouches ?? "—"} />
            </div>
          ) : (
            <p className="text-sm text-text-secondary italic">No usage data imported yet.</p>
          )}
        </div>

        <p className="text-xs text-text-secondary">Data as of {new Date(player.lastUpdated).toLocaleString()}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-surface-sunken px-2 py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
