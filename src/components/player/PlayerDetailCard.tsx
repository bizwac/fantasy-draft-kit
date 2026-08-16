import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Player, PersonalOverride, ScoringFormat, SeasonStatLine } from "@/lib/types";
import { depthChartLabel } from "@/lib/handcuff";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";
import { huddleNewsUrl } from "@/lib/dataSources/huddlePlayers";
import { normalizeName } from "@/lib/dataSources/normalize";
import Badge from "./Badge";

function pointsForFormat(line: SeasonStatLine, scoring: ScoringFormat): number | null {
  switch (scoring) {
    case "std":
      return line.pointsStd;
    case "half":
      return line.pointsHalfPpr;
    case "ppr":
    case "superflex-ppr":
      return line.pointsPpr;
  }
}

// A short "what actually happened" line per position — the raw counting
// stats fantasy managers care about, not the full box score.
function keyStatLine(line: SeasonStatLine, position: Player["position"]): string | null {
  if (position === "QB" && (line.passYd !== null || line.passTd !== null)) {
    return `${line.passYd ?? 0} pass yd, ${line.passTd ?? 0} TD`;
  }
  if ((position === "RB" || position === "WR" || position === "TE") && (line.rushYd || line.recYd || line.rec)) {
    const parts: string[] = [];
    if (line.rushYd) parts.push(`${line.rushYd} rush yd`);
    if (line.rec) parts.push(`${line.rec} rec, ${line.recYd ?? 0} yd`);
    const tds = (line.rushTd ?? 0) + (line.recTd ?? 0);
    if (tds) parts.push(`${tds} TD`);
    return parts.join(", ") || null;
  }
  return null;
}

export default function PlayerDetailCard({
  player,
  scoring,
  tier,
  tierBasis,
  vorp,
  auctionValue,
  handcuff,
  draftedByLabel,
  override,
  onToggleFavorite,
  onToggleDoNotDraft,
  onSaveNote,
  onClose
}: {
  player: Player;
  scoring: ScoringFormat;
  tier: number | null;
  tierBasis: "projection" | "adp" | null;
  vorp: number | null;
  auctionValue: number | null;
  handcuff: Player | null;
  draftedByLabel: string | null;
  override: PersonalOverride | undefined;
  onToggleFavorite: () => void;
  onToggleDoNotDraft: () => void;
  onSaveNote: (note: string) => void;
  onClose: () => void;
}) {
  const depthLabel = depthChartLabel(player);
  const [note, setNote] = useState(override?.note ?? "");
  const seasonStats = useLiveQuery(() => db.seasonStats.get(player.id), [player.id]);
  const [newsOpen, setNewsOpen] = useState(false);
  // Whether a News button shows at all: TheHuddle's depth-chart index
  // only lists active-roster players, so a match here already implies
  // "worth showing" — no separate rank cutoff needed on top of it.
  const huddleEntry = useLiveQuery(() => db.huddlePlayers.get(normalizeName(player.name)), [player.name]);

  // Without this, a wheel/trackpad gesture over the modal that isn't
  // captured by a scrollable target inside it (most notably the news
  // iframe — a cross-origin document has its own separate scroll
  // context the outer page can't always claim the gesture from) chains
  // to the page behind this fixed overlay instead, visibly scrolling
  // the draft board underneath. Locking body scroll while any instance
  // of this modal is mounted closes that off regardless of where the
  // gesture actually lands.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-4 overscroll-contain"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} details`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-sm font-semibold w-10 h-10 shrink-0 flex items-center justify-center rounded"
              style={{ backgroundColor: POSITION_COLOR[player.position], color: POSITION_TEXT_COLOR[player.position] }}
            >
              {player.position}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-text-secondary uppercase tracking-wide">
                {player.team}
                {player.byeWeek ? ` · Bye ${player.byeWeek}` : ""}
              </p>
              <h2 className="font-display text-2xl font-semibold truncate">{player.name}</h2>
            </div>
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={override?.favorite ? "btn-primary text-sm" : "btn-secondary text-sm"}
          >
            {override?.favorite ? "★ Favorited" : "☆ Favorite"}
          </button>
          <button
            type="button"
            onClick={onToggleDoNotDraft}
            className={override?.doNotDraft ? "btn text-sm bg-danger text-white" : "btn-secondary text-sm"}
          >
            {override?.doNotDraft ? "Do-Not-Draft ✕" : "Mark Do-Not-Draft"}
          </button>
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
          <h3 className="text-sm font-semibold text-text-secondary mb-1.5">Season Stats</h3>
          {player.isRookie && !seasonStats?.seasons.length ? (
            <p className="text-sm text-text-secondary italic">Rookie — no NFL history.</p>
          ) : seasonStats && seasonStats.seasons.length > 0 ? (
            <div className="flex flex-col gap-1">
              {seasonStats.seasons.map((line) => {
                const pts = pointsForFormat(line, scoring);
                const stat = keyStatLine(line, player.position);
                return (
                  <div key={line.season} className="flex items-center justify-between gap-3 text-sm rounded-md bg-surface-sunken px-2 py-1.5">
                    <span className="font-medium w-12 shrink-0">{line.season}</span>
                    <span className="text-text-secondary flex-1 min-w-0 truncate">
                      {stat ?? (line.gamesPlayed !== null ? `${line.gamesPlayed} games` : "—")}
                    </span>
                    <span className="tabular-nums font-medium shrink-0">
                      {pts !== null ? `${pts.toFixed(1)} pts` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary italic">Not refreshed yet — see Settings → Season Stats.</p>
          )}
        </div>

        {huddleEntry && (
          <button
            type="button"
            onClick={() => setNewsOpen(true)}
            className="text-left rounded-md bg-surface-sunken px-2.5 py-2 hover:bg-surface-raised transition-colors flex items-center justify-between gap-2"
          >
            <span className="text-sm font-medium">News &amp; Notes</span>
            <span className="text-xs text-text-secondary">TheHuddle ↗</span>
          </button>
        )}

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

        <div>
          <h3 className="text-sm font-semibold text-text-secondary mb-1.5">Note</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onSaveNote(note)}
            maxLength={500}
            rows={3}
            placeholder="Add a note visible on this player's card…"
            className="w-full rounded-md bg-surface-sunken px-2 py-1.5 text-sm"
          />
        </div>

        <p className="text-xs text-text-secondary">Data as of {new Date(player.lastUpdated).toLocaleString()}</p>
      </div>

      {newsOpen && huddleEntry && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-4 overscroll-contain"
          onClick={(e) => {
            e.stopPropagation();
            setNewsOpen(false);
          }}
          role="presentation"
        >
          <div
            className="card w-full h-full sm:w-[95vw] sm:h-[92vh] sm:max-w-5xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${player.name} news`}
          >
            <div className="flex items-center justify-between gap-3 p-3 border-b border-border shrink-0">
              <h2 className="font-display text-base font-semibold truncate">{player.name} — News &amp; Notes</h2>
              <div className="flex items-center gap-2 shrink-0">
                {/* A cross-origin iframe can't be feature-detected for "blocked" from
                    here — this stays visible unconditionally as a guaranteed way out
                    if the embed doesn't render for a given browser/site policy. */}
                <a
                  href={huddleNewsUrl(huddleEntry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-strong hover:underline"
                >
                  Open in new tab ↗
                </a>
                <button type="button" className="btn-secondary text-sm" onClick={() => setNewsOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <iframe
              src={huddleNewsUrl(huddleEntry)}
              title={`${player.name} — TheHuddle`}
              scrolling="yes"
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
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
