import type { TeamProjection, TeamValueSummary } from "@/lib/postDraft";

export function ProjectionStandings({ projections, myTeamSlot }: { projections: TeamProjection[]; myTeamSlot: number }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Team</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">Starter Pts</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((p, i) => (
            <tr key={p.teamSlot} className={["border-b border-border last:border-0", p.teamSlot === myTeamSlot ? "bg-accent/10" : ""].join(" ")}>
              <td className="px-3 py-2 text-text-secondary tabular-nums">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{p.teamName}</td>
              <td className="px-3 py-2 text-right tabular-nums">{p.starterPoints.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ValueStandings({ summaries, myTeamSlot }: { summaries: TeamValueSummary[]; myTeamSlot: number }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Team</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-text-secondary">Value vs ADP</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s, i) => (
            <tr key={s.teamSlot} className={["border-b border-border last:border-0", s.teamSlot === myTeamSlot ? "bg-accent/10" : ""].join(" ")}>
              <td className="px-3 py-2 text-text-secondary tabular-nums">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{s.teamName}</td>
              <td className={["px-3 py-2 text-right tabular-nums font-semibold", s.totalValue >= 0 ? "text-success" : "text-danger"].join(" ")}>
                {s.totalValue >= 0 ? "+" : ""}
                {s.totalValue.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
