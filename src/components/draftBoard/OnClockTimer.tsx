import { useEffect, useState } from "react";
import Badge from "@/components/player/Badge";

// Purely a visual indicator of elapsed time — never reads or writes the
// draft board's state, so a lapsed timer can never block, skip, or
// otherwise affect a pick. Restarts whenever `resetSignal` changes
// (DraftBoard passes the current overall pick number), so a made pick
// always resets the clock for whoever's up next.
export default function OnClockTimer({
  durationSeconds,
  resetSignal
}: {
  durationSeconds: number;
  resetSignal: number | string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    const intervalId = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [resetSignal, durationSeconds]);

  if (secondsLeft <= 0) {
    return <Badge tone="danger">Time's up</Badge>;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return (
    <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold tabular-nums">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
