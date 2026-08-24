// Runs on its own thread specifically so its timer isn't subject to the
// throttling Chrome/Safari apply to setInterval running in a
// backgrounded/unfocused *page* (can drop to roughly once a minute) —
// needed because the Live View is meant to be left open in a screen
// share (e.g. Zoom) with no interaction, which very often means it's
// not the browser's own focused tab even though someone is actively
// watching it. Dedicated Workers run on a separate thread and aren't
// subject to that same background-tab timer throttling, so a heartbeat
// tick posted from here keeps arriving on schedule regardless of
// whether the page itself is focused or visible. This file intentionally
// does no fetching or app logic of its own — it only ticks; the actual
// pull (and everything IndexedDB-related) stays on the main thread.
let timer: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<{ type: "start" | "stop"; intervalMs?: number }>) => {
  if (e.data.type === "start") {
    if (timer) clearInterval(timer);
    timer = setInterval(() => postMessage("tick"), e.data.intervalMs ?? 2000);
  } else if (e.data.type === "stop") {
    if (timer) clearInterval(timer);
    timer = null;
  }
};
