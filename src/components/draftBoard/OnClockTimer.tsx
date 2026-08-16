import { useEffect, useRef, useState } from "react";
import Badge from "@/components/player/Badge";
import { playTimesUpAlert } from "@/lib/sound";

// Purely a visual (and optionally audible) indicator of elapsed time —
// never reads or writes the draft board's state, so a lapsed timer can
// never block, skip, or otherwise affect a pick.
export default function OnClockTimer({
  durationSeconds,
  resetSignal,
  running,
  soundEnabled
}: {
  durationSeconds: number;
  resetSignal: number | string;
  // Whether the clock is actively ticking — controlled by the Start/
  // Pause button on the draft board (see Draft.timerRunning), not this
  // component. A new pick still resets the displayed time to a fresh
  // full duration even while paused, so resuming starts clean.
  running: boolean;
  soundEnabled: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const hasAlertedRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    hasAlertedRef.current = false;
  }, [resetSignal, durationSeconds]);

  useEffect(() => {
    if (!running) return;
    const intervalId = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [running]);

  useEffect(() => {
    if (secondsLeft > 0 || hasAlertedRef.current) return;
    hasAlertedRef.current = true;
    if (soundEnabled) playTimesUpAlert();
  }, [secondsLeft, soundEnabled]);

  if (secondsLeft <= 0) {
    return <Badge tone="danger">Time's up</Badge>;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold tabular-nums">
      {minutes}:{String(seconds).padStart(2, "0")}
      {!running && <span className="text-text-secondary font-normal">Paused</span>}
    </span>
  );
}
