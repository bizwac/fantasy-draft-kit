# Fade Signal — Draft-Day Kit · Handoff Package

Everything Claude Code needs to build the app.

## Contents

- **BUILD_SPEC.md** — the full build specification: features, architecture, data model, data sources, storage, screens, UX/design system, security, QA, and milestones. Start here.
- **FEATURE_SUMMARY.md** — one-page overview of the feature set and locked decisions.
- **brand/** — the Fade Signal brand assets:
  - `icon-dark-1024.png` / `-512` / `-192` / `-180` — app icons (dark, primary)
    - `-180` → iOS `apple-touch-icon`
    - `-192` and `-512` → PWA manifest icons
    - generate favicons from `-512`
  - `icon-light-512.png` — light-tile icon
  - `icon-mono-512.png` — monochrome (one-color) icon
  - `lockup-light.png` / `lockup-dark.png` — horizontal wordmark lockups (transparent PNG)
  - `brand-board.png` — brand usage board (icon variants, lockups, color tokens, rules)

## Brand quick reference

- **Name:** Fade Signal
- **Typeface:** Outfit (Bold for the mark/wordmark) — OFL, bundle with the app
- **Mark:** FS monogram — F off-white full cap, S amber ~78%, tops aligned, just kissing, charcoal knockout outline between them
- **Colors:** charcoal `#202327` · amber `#E7A23B` (accent) · off-white `#F4F5F6`
- Amber is an accent/fill color — do not use it for body text on white (fails WCAG AA). See §6.1c of the spec.

## Build order (see spec §8)

Ship milestones M1–M3 first (create drafts → prepare player data → live draft board with undo/correct). That alone is a usable draft tool; everything else layers on top.
