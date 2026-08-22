import type { PostDraftGrid as Grid } from "@/lib/postDraft";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

export default function PostDraftGrid({ grid, teamNames, myTeamSlot }: { grid: Grid; teamNames: string[]; myTeamSlot: number }) {
  return (
    <div className="card overflow-x-auto print:overflow-visible">
      <table className="border-collapse w-full min-w-max print:min-w-0 print:table-fixed text-sm print:text-[9px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface-raised px-3 py-2 text-left text-xs font-semibold text-text-secondary border-b border-r border-border print:static print:px-1 print:py-1">
              Rd
            </th>
            {teamNames.map((name, i) => (
              <th
                key={i}
                className={[
                  "px-3 py-2.5 text-left text-sm font-bold border-b border-border whitespace-nowrap print:whitespace-normal print:px-1 print:py-1",
                  i + 1 === myTeamSlot ? "bg-accent/20 text-accent-strong" : "text-text-primary"
                ].join(" ")}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.grid.map((row, roundIdx) => (
            <tr key={roundIdx}>
              <td className="sticky left-0 bg-surface-raised px-3 py-2 text-xs font-semibold text-text-secondary border-r border-b border-border print:static print:px-1 print:py-1">
                {roundIdx + 1}
              </td>
              {row.map((cell, teamIdx) => (
                <td
                  key={teamIdx}
                  className={[
                    "px-3 py-2 border-b border-border align-top whitespace-nowrap print:whitespace-normal print:px-1 print:py-1",
                    teamIdx + 1 === myTeamSlot ? "bg-accent/10" : ""
                  ].join(" ")}
                >
                  {cell.player ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-semibold px-1 rounded"
                          style={{ backgroundColor: POSITION_COLOR[cell.player.position], color: POSITION_TEXT_COLOR[cell.player.position] }}
                        >
                          {cell.player.position}
                        </span>
                        <span className="text-xs text-text-secondary tabular-nums">#{cell.pick?.overall}</span>
                      </div>
                      <span className="font-medium">{cell.player.name}</span>
                    </div>
                  ) : (
                    <span className="text-text-secondary">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
