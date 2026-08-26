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

// calc(8) -> "calc(var(--present-scale, 1) * 8px)" — reads the scale
// PresentBoard's useFillScale sets on an ancestor so font-size/padding
// grow with it live (no re-render needed, since it's a CSS var read via
// calc()), and falls back to a literal 1 (i.e. the base value) anywhere
// that variable isn't set.
function calc(base: number): string {
  return `calc(var(--present-scale, 1) * ${base}px)`;
}

export default function PostDraftGrid({
  grid,
  teamNames,
  highlightTeamSlot,
  presentation = false
}: {
  grid: Grid;
  teamNames: string[];
  // Which column gets the accent tint — the Results page passes "my
  // team" (a fixed personal reference on a now-static grid), while the
  // Live View passes whichever team is currently on the clock (so a
  // screen-share viewer can see who's picking at a glance, not just
  // where the organizer's own team sits).
  highlightTeamSlot: number;
  // Bigger player-name text with tightened cell padding/line-height, for
  // the Live View (PresentBoard) only, which scrolls this grid inside a
  // fixed-height section rather than shrinking it to fit. Also switches
  // font-size/padding to read the --present-scale CSS variable (via
  // calc()) that PresentBoard's useFillScale sets on an ancestor, so the
  // grid grows to fill a TV/projector viewport instead of sitting at
  // this ipad-tuned size on a much bigger screen.
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
          purpose to fit one page. Presentation mode skips the floor
          entirely instead: it truncates names to one line rather than
          wrapping them, so there's no mid-word-break risk to floor
          against, and this is the Live View — nobody driving a screen
          share can scroll it for the viewers, so every team column
          actually fitting on screen matters more than a per-column
          minimum width. */}
      <table
        className="post-draft-grid-table border-collapse w-full table-fixed text-sm print:text-[9px]"
        style={{ minWidth: presentation ? undefined : teamNames.length * 96 + 40 }}
      >
        <thead>
          <tr>
            {/* z-30 (above the header row's z-20 and the body's sticky-left
                z-10) since this corner is sticky on both axes at once and
                has to stay on top regardless of scroll direction. The
                card wrapper deliberately has no overflow set (needed so
                sticky resolves against the true outer scroll container —
                see the wrapper comment above), so it can't clip these
                sticky cells' opaque backgrounds to its own rounded
                corners; rounding the corner cells directly is the fix. */}
            <th
              className="sticky left-0 top-0 z-30 w-10 rounded-tl-lg bg-surface-raised px-2 py-2 text-left text-xs font-semibold text-text-secondary border-b border-r border-border print:static print:rounded-none print:px-1 print:py-1"
              style={presentation ? { width: calc(40), padding: `${calc(8)} ${calc(8)}`, fontSize: calc(12) } : undefined}
            >
              Rd
            </th>
            {teamNames.map((name, i) => (
              <th
                key={i}
                className={[
                  "sticky top-0 z-20 px-2 py-2.5 text-left text-sm font-bold border-b border-border whitespace-normal break-words print:static print:px-1 print:py-1 text-text-primary",
                  i === teamNames.length - 1 ? "rounded-tr-lg print:rounded-none" : ""
                ].join(" ")}
                // A plain bg-accent/20 utility is semi-transparent, which
                // is fine for a static header but bleeds scrolled-past
                // rows through once it's sticky — color-mix here
                // pre-composites the same tint against the opaque card
                // background instead, so it stays solid while stuck.
                style={{
                  ...(presentation ? { padding: `${calc(10)} ${calc(8)}`, fontSize: calc(14) } : {}),
                  ...(i + 1 === highlightTeamSlot
                    ? { backgroundColor: "color-mix(in srgb, var(--accent) 20%, var(--surface-raised))", color: "var(--accent-strong)" }
                    : { backgroundColor: "var(--surface-raised)" })
                }}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.grid.map((row, roundIdx) => {
            const isLastRow = roundIdx === grid.grid.length - 1;
            return (
            <tr key={roundIdx}>
              <td
                className={[
                  "sticky left-0 z-10 bg-surface-raised px-2 py-2 text-xs font-semibold text-text-secondary border-r border-b border-border print:static print:px-1 print:py-1",
                  isLastRow ? "rounded-bl-lg print:rounded-none" : ""
                ].join(" ")}
                style={presentation ? { padding: `${calc(8)} ${calc(8)}`, fontSize: calc(12) } : undefined}
              >
                {roundIdx + 1}
              </td>
              {row.map((cell, teamIdx) => (
                <td
                  key={teamIdx}
                  className={[
                    "px-2 border-b border-border align-top print:px-1 print:py-1",
                    presentation ? "" : "py-2",
                    teamIdx + 1 === highlightTeamSlot ? "bg-accent/10" : "",
                    isLastRow && teamIdx === row.length - 1 ? "rounded-br-lg print:rounded-none" : ""
                  ].join(" ")}
                  style={presentation ? { padding: `${calc(4)} ${calc(8)}` } : undefined}
                >
                  {cell.player ? (
                    <div
                      className={["flex items-start", presentation ? "" : "gap-1.5"].join(" ")}
                      style={presentation ? { gap: calc(4) } : undefined}
                    >
                      <div className="flex flex-col items-start gap-0 shrink-0">
                        <span
                          className={["font-semibold px-1 rounded", presentation ? "" : "text-[10px]"].join(" ")}
                          style={{
                            backgroundColor: POSITION_COLOR[cell.player.position],
                            color: POSITION_TEXT_COLOR[cell.player.position],
                            ...(presentation ? { padding: `0 ${calc(4)}`, fontSize: calc(12) } : {})
                          }}
                        >
                          {cell.player.position === "DST" ? "D" : cell.player.position}
                        </span>
                        <span
                          className={["text-text-secondary tabular-nums", presentation ? "" : "text-[10px]"].join(" ")}
                          style={presentation ? { fontSize: calc(10) } : undefined}
                        >
                          #{cell.pick?.overall}
                        </span>
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
                            <div className="flex flex-col min-w-0 flex-1" style={{ gap: calc(4) }}>
                              <span className="font-medium leading-tight truncate block" style={{ fontSize: calc(12) }}>
                                {first}
                              </span>
                              {last && (
                                <span className="font-medium leading-tight truncate block" style={{ fontSize: calc(12) }}>
                                  {last}
                                </span>
                              )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
