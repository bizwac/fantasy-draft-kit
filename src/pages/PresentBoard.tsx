import { useEffect, useMemo, useRef, useState } from "react";
import type { ThemePreference } from "@/lib/useTheme";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { locationForOverallPick, rosterSlotCount } from "@/lib/draftMath";
import { buildPostDraftGrid } from "@/lib/postDraft";
import { startAutoPull } from "@/lib/cloudSync";
import { loadTimerSettings } from "@/lib/timerSettings";
import { useTheme } from "@/lib/useTheme";
import type { Player } from "@/lib/types";
import PostDraftGrid from "@/components/postDraft/PostDraftGrid";
import OnClockTimer from "@/components/draftBoard/OnClockTimer";
import ThemeToggle from "@/components/shared/ThemeToggle";
import Badge from "@/components/player/Badge";

// A read-only, chrome-free view meant for a second tab/window/device on
// screen-share while the real management happens elsewhere (this app,
// same browser or a different one). Pulls from the cloud backup on an
// interval rather than relying on same-browser IndexedDB reactivity,
// since the whole point is that it might not be the same browser.
export default function PresentBoard() {
  const { id } = useParams<{ id: string }>();
  const draft = useLiveQuery(() => (id ? db.drafts.get(id) : undefined), [id]);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const [timerSettings, setTimerSettings] = useState(() => loadTimerSettings());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // AppShell normally applies the stored theme via this hook — this
  // page renders outside AppShell (deliberately chrome-free), so
  // without calling it here a fresh tab/window never gets the .dark
  // class applied at all and has no way to change it either.
  const { preference, setPreference } = useTheme();

  useEffect(() => startAutoPull(() => setTimerSettings(loadTimerSettings())), []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players ?? []) map.set(p.id, p);
    return map;
  }, [players]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  }

  // An alternative to Full Screen for screen-sharing (e.g. Teams): true
  // OS fullscreen takes over the whole display, which either isn't
  // pickable as a single window in a share picker or hides the sharer's
  // own meeting controls. A popup opened with toolbar/location/menubar
  // disabled renders as its own chrome-free, non-fullscreen window that
  // a "share a window" picker sees like any other app window. Sized off
  // the actual screen (not a fixed 1280x800) so a 14-16 round grid has
  // as much room as the laptop can give it before needing to scroll.
  function openPresentationWindow() {
    const width = Math.min(1600, Math.round(window.screen.availWidth * 0.92));
    const height = Math.min(1000, Math.round(window.screen.availHeight * 0.92));
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    window.open(
      window.location.href,
      "fadeSignalLiveView",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,menubar=no,status=no,resizable=yes`
    );
  }

  if (!draft || !players) {
    return <div className="min-h-dvh flex items-center justify-center text-text-secondary">Loading…</div>;
  }

  const totalRounds = rosterSlotCount(draft.settings.rosterSlots);
  const isDraftOver = draft.picks.length >= draft.settings.teams * totalRounds;
  const onClock = isDraftOver ? null : locationForOverallPick(draft.picks.length + 1, draft.settings.teams);
  const onClockTeamName = onClock ? draft.settings.teamNames[onClock.teamSlot - 1] ?? `Team ${onClock.teamSlot}` : null;
  const grid = buildPostDraftGrid(draft, playersById);

  return (
    // h-dvh (not min-h-dvh) caps this at the real viewport height instead
    // of just flooring it there, so the grid section below (flex-1
    // min-h-0) is genuinely height-bounded and its own scrollbar is what
    // handles overflow — not the whole page growing taller than the
    // window.
    <div ref={containerRef} className="h-dvh overflow-hidden bg-surface text-text-primary p-3 md:p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-text-secondary flex items-center gap-2 truncate">
            {draft.name}
            {draft.isMock && <Badge tone="info">Mock</Badge>}
          </p>
          {isDraftOver ? (
            <p className="text-2xl md:text-3xl font-display font-bold text-success">Draft complete</p>
          ) : (
            onClock && (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl md:text-3xl font-display font-bold truncate">{onClockTeamName}</span>
                <span className="text-sm text-text-secondary">
                  on the clock · Pick {onClock.overall} · Round {onClock.round}
                </span>
                {timerSettings.enabled && (
                  // Sound stays off on this view regardless of the setting — it's
                  // meant to be heard on the drafter's own tab, not blasted over
                  // a screen-share to everyone watching.
                  <OnClockTimer
                    durationSeconds={timerSettings.durationSeconds}
                    resetSignal={onClock.overall}
                    running={!!draft.timerRunning}
                    soundEnabled={false}
                  />
                )}
              </div>
            )
          )}
        </div>

        <ViewOptionsMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((o) => !o)}
          onClose={() => setMenuOpen(false)}
          preference={preference}
          onPreferenceChange={setPreference}
          draftId={id ?? ""}
          isFullscreen={isFullscreen}
          onOpenWindow={openPresentationWindow}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {/* PostDraftGrid's table is w-full/table-fixed, so it already
          maximizes horizontal space on its own — no JS scaling needed
          for that. This just caps the section to the remaining vertical
          space and lets it scroll once the round count needs more room
          than that, instead of shrinking the whole grid (including its
          now-larger presentation text) to force everything on screen at
          once. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <PostDraftGrid
          grid={grid}
          teamNames={draft.settings.teamNames}
          highlightTeamSlot={onClock?.teamSlot ?? draft.settings.myDraftSlot}
          presentation
        />
      </div>
    </div>
  );
}

// Collapses what used to be a permanent row of four controls (theme
// toggle, Back to Board, Open in Window, Full Screen) into a single
// icon button — none of them matter to anyone just watching the
// share/screen, so keeping them always on-screen was pure overhead on
// exactly the view meant to maximize space for the grid itself.
function ViewOptionsMenu({
  open,
  onToggle,
  onClose,
  preference,
  onPreferenceChange,
  draftId,
  isFullscreen,
  onOpenWindow,
  onToggleFullscreen
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  preference: ThemePreference;
  onPreferenceChange: (pref: ThemePreference) => void;
  draftId: string;
  isFullscreen: boolean;
  onOpenWindow: () => void;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="relative shrink-0 print:hidden">
      <button
        type="button"
        className="btn-secondary min-h-touch min-w-touch flex items-center justify-center"
        onClick={onToggle}
        aria-label="View options"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreIcon />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={onClose} role="presentation" />
          <div
            className="absolute right-0 top-full mt-2 z-30 card p-2 flex flex-col gap-2 w-56 shadow-raised"
            role="menu"
            aria-label="View options"
          >
            <ThemeToggle preference={preference} onChange={onPreferenceChange} />
            <Link to={`/draft/${draftId}/board`} className="btn-secondary text-sm justify-start" onClick={onClose}>
              Back to Board
            </Link>
            <button
              type="button"
              className="btn-secondary text-sm justify-start"
              onClick={() => {
                onOpenWindow();
                onClose();
              }}
            >
              Open in Window
            </button>
            <button
              type="button"
              className="btn-secondary text-sm justify-start"
              onClick={() => {
                onToggleFullscreen();
                onClose();
              }}
            >
              {isFullscreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="5" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="19" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}
