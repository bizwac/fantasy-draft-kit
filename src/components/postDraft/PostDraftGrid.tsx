import type { PostDraftGrid as Grid } from "@/lib/postDraft";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

export default function PostDraftGrid({ grid, teamNames, myTeamSlot }: { grid: Grid; teamNames: string[]; myTeamSlot: number }) {
  return (
    <div className="card overflow-x-auto print:overflow-visible">
      {/* table-fixed + an explicit width on only the Rd column makes the
          browser split the remaining width evenly across every team
          column, whatever the team count — no per-column width math
          needed here. The inline minWidth is a legibility floor (a name
          like "Jahmyr" mid-word-breaks into "Jahm"/"yr" once its column
          drops much below this) — a container narrower than that just
          scrolls horizontally instead of squeezing columns further. Print
          resets it to 0 (post-draft-grid-table in index.css) since a
          printed page can't scroll and already goes small/dense on
          purpose to fit one page. */}
      <table
        className="post-draft-grid-table border-collapse w-full table-fixed text-sm print:text-[9px]"
        style={{ minWidth: teamNames.length * 96 + 40 }}
      >
        <thead>
          <tr>
            <th className="sticky left-0 w-10 bg-surface-raised px-2 py-2 text-left text-xs font-semibold text-text-secondary border-b border-r border-border print:static print:px-1 print:py-1">
              Rd
            </th>
            {teamNames.map((name, i) => (
              <th
                key={i}
                className={[
                  "px-2 py-2.5 text-left text-sm font-bold border-b border-border whitespace-normal break-words print:px-1 print:py-1",
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
              <td className="sticky left-0 bg-surface-raised px-2 py-2 text-xs font-semibold text-text-secondary border-r border-b border-border print:static print:px-1 print:py-1">
                {roundIdx + 1}
              </td>
              {row.map((cell, teamIdx) => (
                <td
                  key={teamIdx}
                  className={[
                    "px-2 py-2 border-b border-border align-top print:px-1 print:py-1",
                    teamIdx + 1 === myTeamSlot ? "bg-accent/10" : ""
                  ].join(" ")}
                >
                  {cell.player ? (
                    <div className="flex items-start gap-1.5">
                      <div className="flex flex-col items-start gap-0.5 shrink-0">
                        <span
                          className="text-[10px] font-semibold px-1 rounded"
                          style={{ backgroundColor: POSITION_COLOR[cell.player.position], color: POSITION_TEXT_COLOR[cell.player.position] }}
                        >
                          {cell.player.position}
                        </span>
                        <span className="text-[10px] text-text-secondary tabular-nums">#{cell.pick?.overall}</span>
                      </div>
                      <span className="font-medium text-xs leading-tight whitespace-normal break-words line-clamp-2 min-w-0">
                        {cell.player.name}
                      </span>
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
