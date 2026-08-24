import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { buildPostDraftGrid, computeReachesAndSteals, computeTeamProjections, topStealsAndReaches } from "@/lib/postDraft";
import type { Player } from "@/lib/types";
import PostDraftGrid from "@/components/postDraft/PostDraftGrid";
import { ProjectionStandings, ValueStandings } from "@/components/postDraft/TeamStandings";
import Badge from "@/components/player/Badge";
import PageHeader from "@/components/shared/PageHeader";

export default function PostDraft() {
  const { id } = useParams<{ id: string }>();
  const draft = useLiveQuery(() => (id ? db.drafts.get(id) : undefined), [id]);
  const players = useLiveQuery(() => db.players.toArray(), []);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players ?? []) map.set(p.id, p);
    return map;
  }, [players]);

  const grid = useMemo(() => (draft ? buildPostDraftGrid(draft, playersById) : null), [draft, playersById]);
  const projections = useMemo(() => (draft ? computeTeamProjections(draft, playersById) : null), [draft, playersById]);
  const valueSummary = useMemo(() => (draft ? computeReachesAndSteals(draft, playersById) : null), [draft, playersById]);
  const { steals, reaches } = useMemo(
    () => (draft ? topStealsAndReaches(draft, playersById) : { steals: [], reaches: [] }),
    [draft, playersById]
  );

  const myProjection = projections?.find((p) => p.teamSlot === draft?.settings.myDraftSlot);

  if (!draft || !players || !grid) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  if (draft.picks.length === 0) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <Link to={`/draft/${id}/board`} className="btn-secondary text-sm self-start">
          Back to Draft
        </Link>
        <div className="card p-8 text-center text-text-secondary">No picks yet — results will appear once the draft starts.</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-24 print:max-w-none">
      <PageHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
          <h1 className="text-2xl font-display flex items-center gap-2">
            {draft.name} — Results
            {draft.isMock && <Badge tone="info">Mock</Badge>}
          </h1>
          <div className="flex gap-2">
            <Link to={`/draft/${id}/board`} className="btn-secondary text-sm">
              Back to Draft
            </Link>
            <Link to={`/draft/${id}/setup`} className="btn-secondary text-sm">
              Edit Settings
            </Link>
            <button type="button" className="btn-secondary text-sm" onClick={() => window.print()}>
              Export as PDF
            </button>
          </div>
        </div>
      </PageHeader>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Draft Board</h2>
        <PostDraftGrid grid={grid} teamNames={draft.settings.teamNames} highlightTeamSlot={draft.settings.myDraftSlot} />
      </section>

      <section className="flex flex-col gap-3 print:hidden">
        <h2 className="font-display text-lg font-semibold">
          {projections ? "Team Strength (starter projections)" : "Draft Value (pick vs. ADP)"}
        </h2>
        {!projections && (
          <p className="text-sm text-text-secondary">
            No projections imported — ranking by how far below (steal) or above (reach) ADP each team's picks went.
          </p>
        )}
        {projections ? (
          <ProjectionStandings projections={projections} myTeamSlot={draft.settings.myDraftSlot} />
        ) : (
          valueSummary && <ValueStandings summaries={valueSummary} myTeamSlot={draft.settings.myDraftSlot} />
        )}
      </section>

      {myProjection && (
        <section className="flex flex-col gap-3 print:hidden">
          <h2 className="font-display text-lg font-semibold">Your Team by Position</h2>
          <div className="card p-4 flex flex-wrap gap-4">
            {Object.entries(myProjection.byPosition).map(([pos, pts]) => (
              <div key={pos} className="flex flex-col items-center px-3">
                <span className="text-lg font-semibold tabular-nums">{pts.toFixed(1)}</span>
                <span className="text-xs text-text-secondary">{pos}</span>
              </div>
            ))}
          </div>
          {myProjection.roster.byeStackWarnings.length > 0 && (
            <div className="rounded-md bg-surface-sunken border border-warning px-3 py-2 flex flex-col gap-1">
              {myProjection.roster.byeStackWarnings.map((w, i) => (
                <p key={i} className="text-xs text-warning">
                  {w}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {(steals.length > 0 || reaches.length > 0) && (
        <section className="grid sm:grid-cols-2 gap-6 print:hidden">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-success">Biggest Steals</h2>
            {steals.map((s) => (
              <div key={s.pick.overall} className="card px-3 py-2 flex items-center justify-between text-sm">
                <span className="font-medium">{s.player.name}</span>
                <span className="text-text-secondary">
                  {s.teamName} · pick {s.pick.overall}, ADP {s.player.adp?.toFixed(1)}
                </span>
                <span className="text-success font-semibold tabular-nums">+{s.valueVsAdp.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-danger">Biggest Reaches</h2>
            {reaches.map((s) => (
              <div key={s.pick.overall} className="card px-3 py-2 flex items-center justify-between text-sm">
                <span className="font-medium">{s.player.name}</span>
                <span className="text-text-secondary">
                  {s.teamName} · pick {s.pick.overall}, ADP {s.player.adp?.toFixed(1)}
                </span>
                <span className="text-danger font-semibold tabular-nums">{s.valueVsAdp.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
