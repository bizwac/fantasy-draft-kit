import type { ReactNode } from "react";
import { useMainScrolled } from "@/lib/scrollContext";

// Sticks to the top of the shared <main> scroll container (AppShell).
// main deliberately has no padding-top of its own (see its own
// comment) — this element owns that space directly via --content-pt,
// so its solid background genuinely covers it at any scroll position,
// rather than leaving it as an uncovered band that scrolled-past
// content shows through (confirmed via elementFromPoint: real card
// elements were hit-testable there, not a paint artifact).
//
// Deliberately doesn't try to bleed past its parent's *width* — every
// page that uses this either fills main's full width already
// (DraftBoard) or centers a narrower column (Home, Settings, ...), and
// in both cases the scrolling content below sits in that exact same
// width, so matching it is already correct — no separate edge-to-edge
// case to handle there.
export default function PageHeader({ children }: { children: ReactNode }) {
  const scrolled = useMainScrolled();
  return (
    <div
      className={[
        "sticky top-0 z-10 bg-surface pb-3 transition-[border-color,box-shadow] duration-150",
        scrolled ? "border-b border-border shadow-[0_1px_0_0_var(--border)]" : "border-b border-transparent"
      ].join(" ")}
      style={{ paddingTop: "var(--content-pt)" }}
    >
      {children}
    </div>
  );
}
