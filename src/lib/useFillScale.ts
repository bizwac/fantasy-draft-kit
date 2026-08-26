import { useCallback, useLayoutEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const CONVERGED_TOLERANCE = 0.005;
const MAX_PASSES = 6;

function clamp(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

// Grows presentation content (font-size/padding, via a --present-scale
// CSS custom property PostDraftGrid reads through calc()) to fill
// whatever vertical space a container actually has — a TV/projector at
// 1080p or 4K leaves most of the screen blank at the grid's normal,
// ipad-tuned size. Column width already fills the container on its own
// (the grid's table is table-fixed/w-full), so only height needs active
// fitting here.
//
// Growing the font size changes the content's own height, so there's no
// way to compute the right scale in one shot — this loop applies each
// guess directly to the DOM (bypassing React state, which forces a
// synchronous reflow on the very next read) and re-measures in a tight
// loop until it converges.
//
// Uses callback refs rather than a deps-keyed effect: this hook's
// caller (PresentBoard) only renders the actual container/content DOM
// once its own async data has loaded, so the ref-attachment moment
// doesn't line up with any one render in a way an effect's dependency
// array can reliably key off — a callback ref fires exactly when the
// node attaches, whichever render that turns out to be, with no timing
// assumptions needed. Never shrinks below 1: that's the already-tuned
// smaller-screen size, where the container just falls back to its own
// overflow scrolling.
export function useFillScale<C extends HTMLElement = HTMLDivElement, T extends HTMLElement = HTMLDivElement>(
  deps: unknown[]
) {
  const [scale, setScale] = useState(1);
  const containerEl = useRef<C | null>(null);
  const contentEl = useRef<T | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const recompute = useRef(() => {
    const container = containerEl.current;
    const content = contentEl.current;
    if (!container || !content) return;

    let current = 1;
    content.style.setProperty("--present-scale", "1");

    for (let i = 0; i < MAX_PASSES; i++) {
      const containerHeight = container.clientHeight;
      const contentHeight = content.scrollHeight;
      if (!containerHeight || !contentHeight) break;

      const next = clamp(current * (containerHeight / contentHeight));
      if (Math.abs(next - current) < CONVERGED_TOLERANCE) {
        current = next;
        break;
      }
      current = next;
      content.style.setProperty("--present-scale", String(current));
    }

    setScale(current);
  }).current;

  const containerRef = useCallback(
    (node: C | null) => {
      containerEl.current = node;
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
      if (node) {
        const ro = new ResizeObserver(() => recompute());
        ro.observe(node);
        resizeObserver.current = ro;
        recompute();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const contentRef = useCallback(
    (node: T | null) => {
      contentEl.current = node;
      if (node) recompute();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // A change in what's being displayed (new pick, different team names)
  // can change content's natural height without the container itself
  // resizing, which the ResizeObserver above wouldn't catch on its own.
  useLayoutEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, contentRef, scale };
}
