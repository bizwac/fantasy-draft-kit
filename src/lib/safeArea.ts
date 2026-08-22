import type { CSSProperties } from "react";

// A floor, not a straight add: iOS is known to under-report
// safe-area-inset-* in some contexts (see AppShell's own use of this
// same pattern for the sidebar/main top padding), which previously left
// full-bleed modal close buttons and edge-to-edge drawer headers sitting
// right under the notch/dynamic island/home indicator with no real
// clearance. Every full-screen-on-mobile modal (RosterPanel,
// DraftLogPanel, PlayerDetailCard's own card and its news modal,
// ConfirmDraftSheet) applies this to whichever element actually
// determines its close button's on-screen position, so there's always a
// guaranteed minimum gap regardless of what the device reports.
export function safeAreaPadding(minRem = 1): CSSProperties {
  return {
    paddingTop: `max(${minRem}rem, calc(env(safe-area-inset-top) + 0.5rem))`,
    paddingBottom: `max(${minRem}rem, calc(env(safe-area-inset-bottom) + 0.5rem))`,
    paddingLeft: `max(${minRem}rem, calc(env(safe-area-inset-left) + 0.5rem))`,
    paddingRight: `max(${minRem}rem, calc(env(safe-area-inset-right) + 0.5rem))`
  };
}
