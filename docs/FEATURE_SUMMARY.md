# Fade Signal — Draft-Day Kit — One-Page Feature Summary

**Brand:** *Fade Signal* — an **FS monogram** in **Outfit Bold** (F off-white, S amber at ~78%, tops aligned, charcoal knockout outline between them). Palette: charcoal `#202327` + amber `#E7A23B` on off-white `#F4F5F6`. Production icons (dark/light/mono) and wordmark lockups delivered as PNGs; brand board documents usage.


**What it is:** An offline-capable web app (PWA) for iPad that helps you *prepare for* and *execute* live fantasy football snake drafts. Draft-day only — no in-season features. Runs multiple drafts. Default: 12-team snake, Full PPR, lineup 1QB/2RB/2WR/1TE/K/DST (no FLEX), 6 bench + optional IR. Fully static + offline — no backend.

**The one big idea:** Prep online, draft offline. All the smart data is baked into the device before the draft so nothing freezes when the wifi does.

**Built on three pillars:** (1) fast, forgiving draft-day features; (2) clean modern iPad UX — a real design system, touch-first, light/dark, accessible, instant; (3) security & hardening for a local app — validated imports, no runtime CDN, strict CSP, no XSS, no telemetry, all data on-device.

---

## Feature checklist

**Setup & multi-draft**
- [MUST] Create a draft: name it, 12 team names, your draft slot
- [MUST] Run many drafts; personal rankings/notes shared across all of them

**On the clock (the core board)**
- [MUST] Mark players drafted in ≤2 taps; assign to a team
- [MUST] Undo + edit/correct any past pick (recomputes everything)
- [SHOULD] Turn & pick tracker — whose turn, countdown to your next pick
- [SHOULD] Positional scarcity meter — see runs forming
- [SHOULD] Tier-break alerts — "last elite RB on the board"
- [SHOULD] My-roster needs tracker — fills your slots, flags needs + bye stacking

**Your personal board (shared across drafts)**
- [MUST] Favorites (star players)
- [SHOULD] Do-not-draft list (grey out)
- [SHOULD] Per-player notes
- [SHOULD] Custom rank override (drag to reorder your own cheat sheet)

**Player context / data on each card**
- [MUST] Injury status
- [SHOULD] Stats & projections (recent years, for your scoring)
- [SHOULD] ADP + advanced value (VORP, tiers, auction $)
- [SHOULD] Rookie status
- [SHOULD] Position pecking order (depth chart)
- [SHOULD] Handcuff / backup mapping
- [SHOULD] Bye weeks
- [SHOULD] Usage stats (snap %, target share, red-zone touches)
- [COULD] Strength of schedule (season + playoff weeks)
- [COULD] Contract-year status (manual/CSV — no free feed)
- [COULD] "On a winning team" status (above .500 in 2025 AND projected to win in 2026)
- [COULD] Preseason buzz / news (best-effort: trending + injuries)

**After the draft**
- [MUST] Post-draft grid (all teams × rounds)
- [COULD] Post-draft team projections / "who won on paper"

**Data & settings**
- [MUST] Data Refresh screen (pull player data before the draft)
- [MUST] Manual scoring/roster settings form (Yahoo import not built)

---

## Where the data comes from (all free)

| Need | Source | Auth? |
|---|---|---|
| Players, injuries, depth charts, byes, rookies | **Sleeper API** | none |
| ADP | **Fantasy Football Calculator API** | none |
| Projections | **CSV import** (FantasyPros export etc.) | you provide |
| Usage stats | **nflverse** open data | none |
| Scoring settings | **Manual form** | none |

**Yahoo:** not built (you opted out). No backend, no login — the app is fully static and offline.

---

## Decisions locked in
1. "On a winning team" = above .500 in 2025 **AND** projected to win in 2026 (both required)
2. Projections via annual CSV import (no scraping)
3. No Yahoo, no backend — manual settings, fully offline
4. Keep auction $ values as a compare metric (even though snake)
5. Roster: 1QB/2RB/2WR/1TE/K/DST (no FLEX), 6 bench, IR configurable per league

---
*Full details, data model, screen map, and build milestones are in `BUILD_SPEC.md`.*
