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
        "card flex flex-col gap-2 px-4 py-3 sticky top-0 z-10",
        isMyTurn ? "border-accent" : ""
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-display text-lg font-semibold shrink-0">Pick {onClock.overall}</span>
          <span className="text-text-secondary text-sm truncate">
            Round {onClock.round}, Slot {onClock.slotInRound}
          </span>
        </div>
        {timerSettings.enabled && (
          <OnClockTimer
            durationSeconds={timerSettings.durationSeconds}
            resetSignal={onClock.overall}
            running={timerRunning}
            soundEnabled={timerSettings.soundEnabled}
            onToggleRunning={onToggleTimerRunning}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
    </div>
  );
}
