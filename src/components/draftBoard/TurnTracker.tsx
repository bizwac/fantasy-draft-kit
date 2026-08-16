import type { PickLocation } from "@/lib/draftMath";
import type { TimerSettings } from "@/lib/timerSettings";
import OnClockTimer from "./OnClockTimer";

export default function TurnTracker({
  onClock,
  onClockTeamName,
  isMyTurn,
  myNextPick,
  picksUntilMine,
  timerSettings,
  timerRunning,
  onToggleTimerRunning
}: {
  onClock: PickLocation;
  onClockTeamName: string;
  isMyTurn: boolean;
  myNextPick: PickLocation | null;
  picksUntilMine: number | null;
  timerSettings: TimerSettings;
  timerRunning: boolean;
  onToggleTimerRunning: () => void;
}) {
  return (
    <div
      className={[
        "card flex flex-wrap items-center justify-between gap-3 px-4 py-3 sticky top-0 z-10",
        isMyTurn ? "border-accent" : ""
      ].join(" ")}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display text-lg font-semibold">
          Pick {onClock.overall}
        </span>
        <span className="text-text-secondary text-sm">
          Round {onClock.round}, Slot {onClock.slotInRound}
        </span>
        {timerSettings.enabled && (
          <>
            <OnClockTimer
              durationSeconds={timerSettings.durationSeconds}
              resetSignal={onClock.overall}
              running={timerRunning}
              soundEnabled={timerSettings.soundEnabled}
            />
            <button
              type="button"
              className="rounded-full bg-surface-sunken text-text-secondary hover:text-text-primary px-2.5 py-1 text-xs font-semibold transition-colors"
              onClick={onToggleTimerRunning}
            >
              {timerRunning ? "Pause Timer" : "Start Timer"}
            </button>
          </>
        )}
      </div>

      {isMyTurn ? (
        <span className="rounded-full bg-accent text-accent-ink px-3 py-1 text-sm font-semibold">
          You're on the clock
        </span>
      ) : (
        <span className="text-sm">
          On the clock: <span className="font-medium">{onClockTeamName}</span>
        </span>
      )}

      <span className="text-sm text-text-secondary">
        {myNextPick
          ? isMyTurn
            ? "Your pick now"
            : `Your next pick in ${picksUntilMine} (${myNextPick.round}.${myNextPick.slotInRound})`
          : "No more picks for you"}
      </span>
    </div>
  );
}
