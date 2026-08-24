// Runs on its own thread specifically so its timers aren't subject to
// the throttling Chrome/Safari (and especially iOS Safari for an
// installed PWA) apply to setInterval/setTimeout running in a
// backgrounded/unfocused *page* — can drop an interval to roughly once
// a minute, or suspend a pending setTimeout outright until the page is
// foregrounded again. Two independent uses share this file:
//   - "start"/"stop": a periodic tick, used to drive the Live View's
//     cloud poll regardless of whether that tab is actually focused
//     (it's meant to sit in a screen share with no interaction).
//   - "debounce": a resettable one-shot timer, used to coalesce rapid
//     local writes (picks, corrections) into a single cloud push a
//     moment later — same throttling risk on the *pushing* device (e.g.
//     an iPad where the app backgrounds the instant the drafter looks
//     away) if it ran as a plain setTimeout on the page instead.
// This file intentionally does no fetching or app logic of its own —
// it only ever posts "now" back to the main thread, which does the
// actual fetch and every IndexedDB read/write itself.
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

self.onmessage = (e: MessageEvent<{ type: "start" | "stop" | "debounce"; intervalMs?: number; delayMs?: number }>) => {
  const { type } = e.data;
  if (type === "start") {
    if (intervalTimer) clearInterval(intervalTimer);
    intervalTimer = setInterval(() => postMessage("tick"), e.data.intervalMs ?? 2000);
  } else if (type === "stop") {
    if (intervalTimer) clearInterval(intervalTimer);
    intervalTimer = null;
  } else if (type === "debounce") {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => postMessage("fire"), e.data.delayMs ?? 1000);
  }
};
