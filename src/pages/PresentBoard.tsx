import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { locationForOverallPick, rosterSlotCount } from "@/lib/draftMath";
import { buildPostDraftGrid } from "@/lib/postDraft";
import { startAutoPull } from "@/lib/cloudSync";
import { loadTimerSettings } from "@/lib/timerSettings";
import type { Player } from "@/lib/types";
import PostDraftGrid from "@/components/postDraft/PostDraftGrid";
import OnClockTimer from "@/components/draftBoard/OnClockTimer";

const PULL_INTERVAL_MS = 5000;

// A read-only, chrome-free view meant for a second tab/window/device on
// screen-share while the real management happens elsewhere (this app,
// same browser or a different one). Pulls from the cloud backup on an
// interval rather than relying on same-browser IndexedDB reactivity,
// since the whole point is that it might not be the same browser.
export default function PresentBoard() {
  const { id } = useParams<{ id: string }>();
  const draft = useLiveQuery(() => (id ? db.drafts.get(id) : undefined), [id]);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const [timerSettings] = useState(() => loadTimerSettings());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => startAutoPull(PULL_INTERVAL_MS), []);

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

  if (!draft || !players) {
    return <div className="min-h-dvh flex items-center justify-center text-text-secondary">Loading…</div>;
  }

  const totalRounds = rosterSlotCount(draft.settings.rosterSlots);
  const isDraftOver = draft.picks.length >= draft.settings.teams * totalRounds;
  const onClock = isDraftOver ? null : locationForOverallPick(draft.picks.length + 1, draft.settings.teams);
  const onClockTeamName = onClock ? draft.settings.teamNames[onClock.teamSlot - 1] ?? `Team ${onClock.teamSlot}` : null;
  const grid = buildPostDraftGrid(draft, playersById);

  return (
    <div ref={containerRef} className="min-h-dvh bg-surface text-text-primary p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">{draft.name}</h1>
          {isDraftOver ? (
            <p className="text-lg text-success mt-1">Draft complete</p>
          ) : (
            onClock && (
              <p className="text-lg mt-1 flex items-center gap-3 flex-wrap">
                <span>
                  Pick {onClock.overall} · Round {onClock.round} — <span className="font-semibold">{onClockTeamName}</span> on the
                  clock
                </span>
                {timerSettings.enabled && (
                  // Sound stays off on this view regardless of the setting — it's
                  // meant to be heard on the drafter's own tab, not blasted over
                  // a screen-share to everyone watching.
                  <OnClockTimer durationSeconds={timerSettings.durationSeconds} resetSignal={onClock.overall} soundEnabled={false} />
                )}
              </p>
            )
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <Link to={`/draft/${id}/board`} className="btn-secondary text-sm">
            Back to Board
          </Link>
          <button type="button" className="btn-secondary text-sm" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <PostDraftGrid grid={grid} teamNames={draft.settings.teamNames} myTeamSlot={draft.settings.myDraftSlot} />
      </div>
    </div>
  );
}
