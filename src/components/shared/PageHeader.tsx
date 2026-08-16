import type { ReactNode } from "react";
import { useMainScrolled } from "@/lib/scrollContext";

// Sticks to the top of the shared <main> scroll container (AppShell) —
// since it's a child of main's own padded box, "top: 0" naturally stops
// right at that padding edge, which already respects the safe-area-aware
// top padding AppShell applies, no separate offset math needed here.
// Deliberately doesn't try to bleed past its parent's width — every page
// that uses this either fills main's full width already (DraftBoard) or
// centers a narrower column (Home, Settings, ...), and in both cases the
// scrolling content below sits in that exact same width, so matching it
// is already correct — no separate edge-to-edge case to handle.
// Solid background so scrolled content is fully occluded underneath it;
// the border/shadow only appears once there's something to occlude.
export default function PageHeader({ children }: { children: ReactNode }) {
  const scrolled = useMainScrolled();
  return (
    <div
      className={[
        "sticky top-0 z-10 bg-surface pb-3 transition-[border-color,box-shadow] duration-150",
        scrolled ? "border-b border-border shadow-[0_1px_0_0_var(--border)]" : "border-b border-transparent"
      ].join(" ")}
    >
      {children}
    </div>
  );
}
