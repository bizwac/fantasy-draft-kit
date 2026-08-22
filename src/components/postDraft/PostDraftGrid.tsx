import type { PostDraftGrid as Grid } from "@/lib/postDraft";
import { POSITION_COLOR, POSITION_TEXT_COLOR } from "@/lib/positionColors";

// Splits on the first space only, so a suffix ("Michael Pittman Jr.") or
// a multi-word last name ("Amon-Ra St. Brown" → "Amon-Ra" / "St. Brown")
// stays attached to the last-name line rather than getting its own line.
function splitName(name: string): [string, string] {
  const spaceIndex = name.indexOf(" ");
  if (spaceIndex === -1) return [name, ""];
  return [name.slice(0, spaceIndex), name.slice(spaceIndex + 1)];
}

export default function PostDraftGrid({
  grid,
  teamNames,
  myTeamSlot,
  presentation = false
}: {
  grid: Grid;
  teamNames: string[];
  myTeamSlot: number;
  // Bigger player-name text with tightened cell padding/line-height, for
  // the Live View (PresentBoard) only, which scrolls this grid inside a
  // fixed-height section rather than shrinking it to fit.
  presentation?: boolean;
}) {
  return (
    // presentation mode skips its own overflow-x-auto: PresentBoard's
    // wrapper already provides one shared scroll container for both
    // axes, and nesting a second overflow-x-auto div inside it would
    // itself become the nearest "scroll container" that position:sticky
    // resolves against (CSS quietly forces overflow-y to auto once
    // overflow-x isn't visible) — since that inner div is never itself
    // height-constrained, nothing would ever actually need to "stick"
    // relative to it, silently breaking the sticky header/round column
    // during real vertical scroll.
    <div className={["card print:overflow-visible", presentation ? "" : "overflow-x-auto"].join(" ")}>
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
            {/* z-30 (above the header row's z-20 and the body's sticky-left
                z-10) since this corner is sticky on both axes at once and
                has to stay on top regardless of scroll direction. */}
            <th className="sticky left-0 top-0 z-30 w-10 bg-surface-raised px-2 py-2 text-left text-xs font-semibold text-text-secondary border-b border-r border-border print:static print:px-1 print:py-1">
              Rd
            </th>
            {teamNames.map((name, i) => (
              <th
                key={i}
                className="sticky top-0 z-20 px-2 py-2.5 text-left text-sm font-bold border-b border-border whitespace-normal break-words print:static print:px-1 print:py-1 text-text-primary"
                // A plain bg-accent/20 utility is semi-transparent, which
                // is fine for a static header but bleeds scrolled-past
                // rows through once it's sticky — color-mix here
                // pre-composites the same tint against the opaque card
                // background instead, so it stays solid while stuck.
                style={
                  i + 1 === myTeamSlot
                    ? { backgroundColor: "color-mix(in srgb, var(--accent) 20%, var(--surface-raised))", color: "var(--accent-strong)" }
                    : { backgroundColor: "var(--surface-raised)" }
                }
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.grid.map((row, roundIdx) => (
            <tr key={roundIdx}>
              <td className="sticky left-0 z-10 bg-surface-raised px-2 py-2 text-xs font-semibold text-text-secondary border-r border-b border-border print:static print:px-1 print:py-1">
                {roundIdx + 1}
              </td>
              {row.map((cell, teamIdx) => (
                <td
                  key={teamIdx}
                  className={[
                    "px-2 border-b border-border align-top print:px-1 print:py-1",
                    presentation ? "py-1" : "py-2",
                    teamIdx + 1 === myTeamSlot ? "bg-accent/10" : ""
                  ].join(" ")}
                >
                  {cell.player ? (
                    <div className={["flex items-start", presentation ? "gap-1" : "gap-1.5"].join(" ")}>
                      <div className="flex flex-col items-start gap-0 shrink-0">
                        <span
                          className={["font-semibold px-1 rounded", presentation ? "text-xs" : "text-[10px]"].join(" ")}
                          style={{ backgroundColor: POSITION_COLOR[cell.player.position], color: POSITION_TEXT_COLOR[cell.player.position] }}
                        >
                          {cell.player.position}
                        </span>
                        <span className="text-[10px] text-text-secondary tabular-nums">#{cell.pick?.overall}</span>
                      </div>
                      {presentation ? (
                        // First and last name each get their own line and
                        // truncate independently (a long first name never
                        // steals room from the last name or vice versa),
                        // with enough gap between them to use the cell's
                        // full height rather than sitting tight together.
                        (() => {
                          const [first, last] = splitName(cell.player.name);
                          return (
                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                              <span className="font-medium text-base leading-tight truncate block">{first}</span>
                              {last && <span className="font-medium text-base leading-tight truncate block">{last}</span>}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="font-medium whitespace-normal break-words line-clamp-2 min-w-0 text-xs leading-tight">
                          {cell.player.name}
                        </span>
                      )}
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
