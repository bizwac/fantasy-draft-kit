# Fantasy Football Draft-Day Kit — Build Specification

**Prepared for:** Brandon
**Purpose:** A complete, hand-off-ready specification for Claude Code to implement a personal fantasy football **draft-day kit**.
**Version:** 1.0 — August 2026 (targets the 2026 NFL season)

> **Amendment (2026-08-15):** The "no Yahoo, no backend" decision below (§2.6, §10 #3) has been
> reversed — Brandon has applied for Yahoo Fantasy API access (approval pending) and wants Yahoo
> integration built once it's granted. Separately, a minimal backend already exists ahead of that:
> a single Vercel serverless function (`api/adp.ts`) proxies Fantasy Football Calculator's ADP API,
> which has no CORS headers and can't be called directly from the browser. The rest of the app
> remains local-first (IndexedDB, offline draft board); Yahoo OAuth will be the second reason for
> a server-side component once access arrives.

---

## 0. Read This First (Orientation for the Implementer)

This is a **draft-day tool**, not a season-long fantasy manager. Its entire job is to make the owner (Brandon) faster and smarter during the ~2 hours of a live snake draft, and to let him prepare beforehand. There is **no in-season phase** — no weekly lineups, no live game scoring, no waiver management. Do not build those.

The product runs as an **offline-capable web app** on an iPad (Safari), installed to the home screen as a PWA. The guiding non-functional requirement is **robustness under bad connectivity**: draft rooms often have flaky wifi, and a tool that freezes when the network drops is worse than useless. Therefore: **all draft-day interactions must work with zero network access.** The network is used only to *prepare* data before the draft and, optionally, to sync with Yahoo.

The user runs **multiple drafts per year** (different leagues, possibly different settings). The app must treat "a draft" as a first-class, repeatable object: create many, switch between them, keep personal rankings/notes shared across them.

Default league profile unless configured otherwise: **12-team snake, Full PPR, starting lineup 1QB / 2RB / 2WR / 1TE / K / DST (no FLEX), 6 bench + optional IR.** All of this is per-draft configurable.

> **Decisions locked with Brandon (Aug 2026):** No Yahoo integration — manual settings only, so **no backend is built** (fully static + offline). Projections come from **annual CSV import**. **Auction $ values are kept** even though drafts are snake. "On a winning team" is a **two-part** flag (see §4.13). Default roster is above.

---

## 1. Architecture Overview

### 1.1 Recommended stack

- **Frontend:** A single-page web app. Recommended: **React + TypeScript + Vite**, styled with Tailwind. Keep it a PWA (installable, offline via service worker). No framework is mandated, but favor something with a fast dev loop and good offline story.
- **Local persistence:** **IndexedDB** (via a thin wrapper like `idb` or `Dexie`). This holds the player dataset, all drafts, personal rankings, notes, favorites, and do-not-draft lists. LocalStorage is acceptable only for small settings; the player dataset is too large for it.
- **Offline:** Service worker caches the app shell and the last-prepared player dataset. The app must fully boot and run a draft with the network off.
- **Backend:** **None.** Brandon opted out of Yahoo, so there is **no backend to build** — the app is 100% static + local (frontend + IndexedDB only). (If Yahoo is ever revisited, it would need a small serverless OAuth proxy — see §2.6 — but that is out of scope for this build. Keep the settings layer clean enough that it *could* be added later without a rewrite.)

### 1.2 Two clean phases

The app has two modes, and the data flows one direction:

```
   PREP PHASE (needs network)                DRAFT PHASE (fully offline)
   ┌───────────────────────────┐            ┌───────────────────────────┐
   │  Data Refresh pipeline     │            │  Live Draft Board          │
   │  pulls player universe,    │  writes    │  reads local dataset,      │
   │  injuries, ADP, projections│ ─────────▶ │  records picks locally,    │
   │  byes, depth, SoS, usage   │  IndexedDB │  never requires network    │
   │  → normalized local dataset│            │                            │
   └───────────────────────────┘            └───────────────────────────┘
```

**Critical rule:** The draft board never calls the network in its hot path. Everything it needs was baked into the local dataset during prep.

---

## 2. Data Sources (Important — Read Carefully)

The hardest part of this project is **getting good player data without a paid feed**. Below is the recommended sourcing, chosen for being free and not requiring the user's league credentials. The implementer should build a **normalization layer** so any single source can be swapped without touching the UI.

### 2.1 Player universe, injuries, depth charts, bye weeks, metadata — **Sleeper API (recommended primary)**

- **Why:** Sleeper's read API is **fully public, free, and requires no authentication or API key.** This is the single best free source for the core player database.
- **Key endpoints:**
  - `GET https://api.sleeper.app/v1/players/nfl` — the full NFL player dump: names, teams, positions, **injury_status**, **depth_chart_order** / **depth_chart_position**, years_exp (→ rookie detection), status. This is a large payload (several MB); **fetch once per prep, cache locally, do not call it on every load.** Sleeper explicitly asks callers to fetch this at most once per day.
  - `GET https://api.sleeper.app/v1/players/nfl/trending/add?limit=50` — trending "hot" players (proxy for buzz/news).
- **Rookie status:** derive from `years_exp === 0` (and cross-check `metadata`/draft year).
- **Handcuff / depth mapping:** derive from `depth_chart_order` + `depth_chart_position` grouped by team — this is how you link a starter to his backup.
- **Note:** Sleeper does not provide ADP or fantasy projections; those come from the sources below.

### 2.2 ADP (Average Draft Position) — **Fantasy Football Calculator (recommended)**

- **Why:** Fantasy Football Calculator exposes a **free public ADP JSON endpoint** and lets you pick format (ppr / half-ppr / standard) and team count (e.g. 12).
- **Endpoint shape:** `GET https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=12&year=2026` (parameterize format + teams + year).
- Gives per-player ADP, position, team, and a std-dev — usable directly for the "ADP & ranking metrics" feature and as a baseline for tiers.

### 2.3 Projections + advanced ranks — **configurable import (recommended: CSV import + optional scraper)**

- Free, reliable, license-clean *projection* APIs are scarce. **FantasyPros** has the best consensus data but its API needs a key/paid tier, and scraping is fragile and against some ToS. **Do not hard-depend on scraping.**
- **Recommended approach:** support a **CSV/JSON import** on the Data Refresh screen. The user can export projections/rankings from FantasyPros (free account allows CSV export of rankings/cheat sheets) or any site, drop the file in, and the app maps columns. This is robust, legal, and puts the user in control.
- Optionally, implement pluggable "source adapters" (Sleeper, FFCalc, CSV) behind one interface so a projections adapter can be added later without UI changes.
- **nflverse / nfl-data** (open data, e.g. `nflverse` CSVs on GitHub) is a good free source for **historical usage stats** (snap %, target share, red-zone touches) used in the "usage stats" enrichment. These are season-level historical files — fine to bundle/refresh during prep.

### 2.4 Strength of Schedule — **derived**

- Compute a simple SoS from the season's schedule + prior-year points-allowed-by-position, or import via CSV. Keep it a labeled estimate, not presented as gospel. Show both full-season and fantasy-playoff-weeks (Weeks 15–17) SoS.

### 2.5 Player news / preseason buzz — **best-effort, clearly labeled**

- True per-player news feeds are mostly paid. Provide two free signals instead: (a) Sleeper **trending adds** as a buzz indicator, and (b) **injury_status** from Sleeper. Optionally allow the user to paste a news blurb into a player's notes. Label this section "Buzz / Status" so expectations are set; do not promise a full news wire.

### 2.6 Yahoo integration — **OUT OF SCOPE for this build (deferred)**

> **Decision:** Brandon is not registering a Yahoo developer app, so **do not build Yahoo integration.** Scoring and roster settings are entered via the manual form (§5). This section is retained only as future-reference should he revisit it. Skip to §2.7.

- **Reality:** The Yahoo Fantasy Sports API requires a **registered developer app and OAuth2 login.** The user is unsure he'll have API access — so Yahoo must be **strictly optional.** The app must be fully usable with zero Yahoo connection.
- **If enabled, use it for two things only:**
  1. **Import league scoring + roster settings** (`league/{key}/settings`) so the user doesn't hand-enter them.
  2. **Import the league's draft order / teams** and, if the draft is on Yahoo, optionally **poll draft results** (`league/{key}/draftresults`) to auto-mark picks. Treat live polling as a *stretch* feature and always keep manual marking as the primary, authoritative path (see §4.3).
- **Implementation:** OAuth handled by the small serverless function (§1.1). Store only short-lived tokens; never embed the client secret in the frontend. If the function is unavailable, the app silently falls back to manual entry.
- **Fallback for scoring settings:** a manual settings form (see §5) is the default and always present.

### 2.7 Data-source summary table

| Data | Primary free source | Auth needed | Notes |
|---|---|---|---|
| Player universe, positions, teams | Sleeper `/players/nfl` | None | Fetch ≤1×/day, cache |
| Injury status | Sleeper `injury_status` | None | |
| Rookie status | Sleeper `years_exp` | None | Derived |
| Depth chart / handcuffs | Sleeper `depth_chart_*` | None | Derived, grouped by team |
| Bye weeks | Sleeper / schedule file | None | |
| ADP | Fantasy Football Calculator API | None | Format + team-count params |
| Projections | CSV import (FantasyPros export etc.) | User-provided | Pluggable adapter |
| Usage stats (snap %, targets, RZ) | nflverse open CSVs | None | Historical |
| Strength of schedule | Derived / CSV | None | Labeled estimate |
| Buzz / news | Sleeper trending + injury | None | Best-effort, labeled |
| Scoring & roster settings | Manual form (default) / Yahoo (optional) | Yahoo=OAuth | Manual always available |
| Live pick sync | Manual marking (default) / Yahoo poll (stretch) | Yahoo=OAuth | Manual is authoritative |

---

## 3. Data Model

Store these as IndexedDB object stores. IDs below are logical.

### 3.1 `players` (shared across all drafts — the prepared dataset)

```
Player {
  id: string                 // stable id (use Sleeper player_id)
  name: string
  team: string               // e.g. "PHI", or "FA"
  position: "QB"|"RB"|"WR"|"TE"|"K"|"DST"
  byeWeek: number | null
  injuryStatus: string | null      // "Questionable","Out","IR", etc.
  isRookie: boolean
  contractYear: boolean | null      // see §4 note on sourcing
  teamWinningRecordLastYear: boolean|null // 2025 record > .500
  teamProjectedWinning: boolean|null      // 2026 projected wins > 8.5
  winningTeam: boolean|null               // = both of the above (see §4.13)
  depthChartOrder: number | null     // 1 = starter
  depthChartPos: string | null
  handcuffOfPlayerId: string | null  // derived link to the starter above him
  // metrics (from ADP/projections/usage sources; may be null if not imported)
  adp: number | null
  adpStdDev: number | null
  projPoints: number | null          // for the active scoring format
  positionRank: number | null        // e.g. RB7 — "position pecking order"
  overallRank: number | null
  tier: number | null                // computed, see §4.4
  vorp: number | null                // value over replacement, computed §4.8
  auctionValue: number | null        // computed $ value, §4.8
  sosSeason: number | null           // 1-10 or percentile
  sosPlayoffs: number | null
  usage: {                           // recent-season, from nflverse
    snapPct: number|null,
    targetShare: number|null,
    rzTouches: number|null,
    season: number|null
  } | null
  trendingAddCount: number | null    // buzz proxy
  lastUpdated: ISO8601
}
```

Notes on trickier fields:
- **contractYear:** No free API cleanly exposes contract-year status. Implement it as (a) an optional CSV column the user can import, and (b) a manual per-player toggle. Do **not** block the build on an automated source.
- **winningTeam (two-part flag — CONFIRMED definition):** Brandon wants this to fire only when **both** are true: (1) the player's NFL team finished **above .500 last season (2025)**, AND (2) the team is **projected to have a winning season this year (2026)**. Model as two booleans plus the combined flag:
  - `teamWinningRecordLastYear: boolean` — from a bundled static JSON of 2025 team records (ships with the app, updates once a year).
  - `teamProjectedWinning: boolean` — from a projected-wins input: bundle/import Vegas win totals or a projected standings CSV; "projected winning" = projected wins > 8.5 (over .500). Allow manual override.
  - `winningTeam = teamWinningRecordLastYear && teamProjectedWinning`.
  Replaces the old single `onPlayoffTeamLastYear` field in §3.1.

### 3.2 `personalRankings` (shared across all drafts)

The user's own opinions persist independently of any single draft.

```
PersonalOverride {
  playerId: string
  customRank: number | null    // user's drag-to-reorder rank
  favorite: boolean            // star
  doNotDraft: boolean          // grey out / skip
  note: string | null          // free text shown on player card
}
```

### 3.3 `drafts` (one per league/mock)

```
Draft {
  id: string
  name: string                 // e.g. "Home League 2026", "ESPN Mock #3"
  createdAt: ISO8601
  settings: {
    teams: number              // default 12
    scoring: "ppr"|"half"|"std"|"superflex-ppr"|...  // default "ppr"
    rosterSlots: {             // starters + bench; drives roster tracker
      QB:number, RB:number, WR:number, TE:number,
      FLEX:number, SUPERFLEX?:number, K:number, DST:number,
      BENCH:number, IR?:number
    }
    // DEFAULT for Brandon's main league:
    // { QB:1, RB:2, WR:2, TE:1, FLEX:0, K:1, DST:1, BENCH:6, IR:0 }
    // Note: no FLEX. Some of his leagues add an IR slot — IR is configurable
    // per draft. Roster tracker and VORP replacement levels derive from this.
    snake: true
    myDraftSlot: number        // 1..teams — the user's position
    teamNames: string[]        // length == teams, index = slot-1
  }
  picks: Pick[]                // append-only log with undo support
  status: "setup"|"live"|"complete"
}

Pick {
  overall: number              // 1..N
  round: number
  slotInRound: number
  teamSlot: number             // which team (1..teams) made the pick
  playerId: string
  timestamp: ISO8601
  corrected: boolean           // true if this pick was edited after the fact
}
```

The draft board state (who's on the clock, best available, etc.) is **derived** from `picks` + `settings`, never stored redundantly. This makes undo/correction trivial and bug-resistant.

---

## 3b. Storage & Persistence

All data lives **on the device** — no server, no cloud sync. The storage system has three layers, each chosen for what it's good at, plus a manual backup path. Building this correctly is critical: the app must survive reloads, offline use, and weeks of sitting idle between setup and draft day without losing state.

### 3b.1 The three storage layers

**1. IndexedDB — primary datastore (the workhorse).**
Holds all structured, sizable data. Build on a thin wrapper (**Dexie** or **idb**) rather than the raw API. Three object stores (schemas in §3):
- `players` — the prepared player dataset (several MB from Sleeper + ADP + imported projections). Refreshed during the online prep step; read-only during a draft.
- `personalRankings` — favorites, do-not-draft, notes, custom rank order. **Shared across all drafts** and **keyed by player ID** so it survives data refreshes and roster changes.
- `drafts` — one record per league/mock, each holding its `settings` and an **append-only `picks` log**. All board state (on-the-clock, best available, roster tracker) is **derived** from that log, never stored redundantly — this is what makes undo and pick-correction safe.

**2. LocalStorage — small UI state only.**
Theme (light/dark), last-opened draft ID, filter preferences, and similar tiny key-values. **Never** the player dataset or drafts — it's too small (~5MB) and synchronous/slow. Keep it to a handful of primitive settings.

**3. Cache Storage API (service worker) — offline app + data snapshot.**
Caches the app shell (code, fonts, icons) and a copy of the **last-good player dataset** so the app fully boots and runs with the network off. Uses a **versioned cache** with a clear update strategy; old caches purged on activate. A failed refresh must never overwrite a good cached dataset with partial data (validate first, then write — see §7b.5).

### 3b.2 Persistence & eviction safeguard (important for iPad)

iOS Safari can **evict** a web app's local storage when the device is low on space or the PWA hasn't been opened in a while. Because the user often sets this up **weeks before** a draft, that risk is real and must be defended against:

- On first launch (and after install-to-home-screen), call **`navigator.storage.persist()`** to request persistent storage, which marks the data as protected from automatic eviction. Handle both grant and denial gracefully.
- Surface **`navigator.storage.estimate()`** usage on the Data Refresh screen so the user can see storage is healthy before a draft.
- Treat the **JSON export/import of personal data (§3b.3)** as the ultimate safety net: even in the worst case (storage cleared, new device), the user can restore their rankings/notes from a backup file.
- The pre-draft dry-run checklist (§8b) already includes a "confirm data present + offline works" step; persistence is what makes that reliable weeks out.

### 3b.3 Backup & portability

- **Export:** one-tap export of `personalRankings` (favorites, DND, notes, custom ranks) as a JSON file, delivered via the normal share/download flow. This is the only data that isn't trivially re-fetchable, so it's the thing worth backing up.
- **Import:** load that JSON on a new device or after a reset; **validate against a schema before merging** (§7b.2) and merge by player ID (don't blow away existing entries silently — reconcile).
- Drafts and the player dataset are intentionally *not* part of the cloud story: player data is re-fetched in the prep step, and drafts are ephemeral per-season. (If the user later wants draft history to be portable, adding drafts to the same JSON export is a clean extension.)

### 3b.4 What is NOT used

- **No server-side storage, no accounts, no cloud database.** Everything is local by design (privacy + offline + simplicity).
- **No cookies** for data; the app is fully client-side.

---

## 4. Feature Specifications

Each feature: **what it does**, **data it needs**, **where it lives (UI)**, **edge cases**. Priority tags: **[MUST]** = core to draft day, **[SHOULD]** = high value, **[COULD]** = nice-to-have.

### 4.1 Create draft with 12 team names + draft position **[MUST]**

- **What:** Setup screen to name a draft, set team count (default 12), enter each team's name, and set the user's own draft slot. Snake order is assumed.
- **Data:** `Draft.settings` (teams, teamNames[], myDraftSlot).
- **UI:** "New Draft" flow. A list of N name fields (pre-filled "Team 1"…"Team N", editable). A picker for "your slot." Team-count selector (8/10/12/14) that grows/shrinks the name list.
- **Edge cases:** Changing team count after names are entered must preserve existing names. Slot must be within 1..teams. Blank names fall back to "Team k."

### 4.2 Run multiple drafts **[MUST]**

- **What:** A drafts list ("dashboard") to create, open, duplicate, rename, and delete drafts. Personal rankings/notes/favorites are shared across all of them; picks are per-draft.
- **Data:** `drafts` store + shared `personalRankings`.
- **UI:** Home screen = list of draft cards (name, date, teams, progress "37/180 picked", status). Tap to open. Long-press / menu for duplicate/rename/delete.
- **Edge cases:** Deleting a draft must not touch shared rankings. "Duplicate" copies settings but resets picks (useful for re-mocking the same league).

### 4.3 Live draft board — mark players drafted, with correction **[MUST]**

- **What:** The core screen. As players come off the board, the user taps a player to mark them drafted and assigns them to the team that picked them (default: the team currently on the clock). Full **undo/redo** and **edit any past pick**.
- **Data:** appends to `Draft.picks`; derives board state.
- **UI:**
  - Big searchable/filterable player list (best available first), each row tappable.
  - Tapping a player opens a quick confirm: player + which team (defaults to on-the-clock team) + Confirm. One tap in the common case.
  - Persistent **Undo** button (undo last pick) and a **Draft Log** view listing every pick in order, each editable (reassign team, change player, or delete/return-to-pool).
  - Clear visual: drafted players are struck through / dimmed in the main list.
- **Edge cases:**
  - **Correcting mistakes is a headline requirement:** editing or deleting any pick must recompute all downstream state (whose turn it is, best available, roster tracker) correctly.
  - Prevent drafting the same player twice; if a correction frees a player, return them to the pool.
  - Marking a player must be **instant and offline** — no spinner, no network.
  - Handle "keeper"/pre-taken players: allow marking players as already drafted before pick 1 (optional).

### 4.4 Tier-break alerts **[SHOULD]**

- **What:** Players grouped into tiers per position; the board warns when a tier is nearly empty ("Last elite RB — 1 left in Tier 2").
- **Data:** `Player.tier`. Compute tiers from ADP/projection gaps (e.g. clustering on projected points or ADP jumps). Recompute "players remaining in tier" live from picks.
- **UI:** Tier dividers in the position views; a banner/toast when the on-the-clock user has ≤N left in a tier at a position of need. Color-coded tier badges (see §6 dataviz note).
- **Edge cases:** Tiers must recompute remaining counts as players are drafted. If projections aren't imported, fall back to ADP-based tiers and label them as such.

### 4.5 Positional scarcity meter **[SHOULD]**

- **What:** Live count of quality players left at each position, so the user sees a run forming.
- **Data:** derived from remaining players filtered by a "quality" threshold (e.g. above replacement, or within top tiers).
- **UI:** A compact row of position chips (QB/RB/WR/TE/K/DST) each showing remaining-quality count, updating every pick. Optional small bar/sparkline.
- **Edge cases:** Define "quality" transparently (e.g. remaining players with positionRank above the replacement line for the league size). Don't let K/DST clutter the signal — de-emphasize them.

### 4.6 Turn & pick tracker **[SHOULD]**

- **What:** Shows snake order, whose turn it is now, and counts down to the user's next pick ("You're up in 6 picks — you hold 4.03 and 5.10").
- **Data:** derived from `settings` (teams, myDraftSlot, snake) + `picks.length`.
- **UI:** A slim header on the draft board: current overall pick, round, on-the-clock team, and "your next pick in N (round.slot)." Highlight when it's the user's turn.
- **Edge cases:** Snake reversal math each round must be correct. After a correction that changes pick count, the tracker updates. Optionally show the user's full list of upcoming pick numbers.

### 4.7 My-roster needs tracker **[SHOULD]**

- **What:** As the user drafts *their own* team, auto-fill starter/bench slots and flag remaining needs; warn on bye-week stacking.
- **Data:** `settings.rosterSlots` + this user's picks + `Player.byeWeek`, `position`.
- **UI:** A "My Roster" panel: slots (QB, RB1, RB2, WR1…, FLEX, BENCH…) filling as they draft, empty slots highlighted as "needs." A bye-week mini-summary flags when 3+ starters share a bye or when a position's starters all share one.
- **Edge cases:** FLEX/SUPERFLEX assignment logic (fill dedicated slots first, overflow to FLEX, then bench). Corrections must re-derive the roster. Superflex counts a second QB as a starter.

### 4.8 ADP & advanced value metrics **[SHOULD]**

- **What:** Show ADP plus richer cross-position value: VORP (value over replacement), computed tiers, and auction $ values.
- **Data:** `adp` (from FFCalc), `projPoints` (imported); compute `vorp` = projPoints − replacement-level points for that position given league size/roster; convert VORP to `auctionValue` via standard budget allocation ($200 default, configurable).
- **UI:** Sortable columns / player-card stats: ADP, Overall Rank, Pos Rank, Tier, VORP, $Val. Let the user sort the board by any of these.
- **Edge cases:** If projections aren't imported, VORP/$ are unavailable — hide them gracefully and rely on ADP. Recompute replacement level from actual league settings, not hardcoded.

### 4.9 Player stats & projections (recent years) **[SHOULD]**

- **What:** Per-player recent-season stats and current-year projection.
- **Data:** `usage` + `projPoints` + historical stat lines (nflverse). Show last 1–2 seasons.
- **UI:** Player detail card: projection for the active scoring format, plus recent stats (games, targets/carries, yards, TDs, snap %, target share, RZ touches).
- **Edge cases:** Rookies have no prior stats — show "Rookie — no NFL history" and lean on projection + draft capital. Format-sensitive projections (PPR vs standard) must reflect the draft's scoring.

### 4.10 Injury status **[MUST]**

- **What:** Current injury designation on each player.
- **Data:** Sleeper `injury_status`.
- **UI:** A colored badge on the row/card (e.g. Q/D/O/IR). Filter: "hide players who are Out/IR."
- **Edge cases:** Values can be null (healthy) — render nothing. Data is only as fresh as the last prep refresh; show a "data as of {date}" stamp.

### 4.11 Rookie status **[SHOULD]**

- **What:** Flag rookies.
- **Data:** derived `isRookie`.
- **UI:** "R" badge; filter to show only rookies (useful for dynasty/keeper thinking and late-round upside).
- **Edge cases:** Derive from years_exp==0; verify against draft class where possible.

### 4.12 Contract-year status **[COULD]**

- **What:** Flag players in a contract year (motivation/usage angle).
- **Data:** `contractYear` — **not reliably available free.** Support CSV import + manual toggle.
- **UI:** Small badge; filter.
- **Edge cases:** Expect this to be sparse/manual. Never block the build on an automated feed. Clearly the lowest-confidence data field.

### 4.13 "On a winning team" status **[COULD]**

- **What:** Flag players in a strong team environment. **Two-part definition (confirmed):** the team was **above .500 last year (2025)** AND is **projected to win this year (2026)**. Both must be true for the flag.
- **Data:** `teamWinningRecordLastYear` (bundled 2025 records JSON) + `teamProjectedWinning` (Vegas win totals / projected-standings CSV, >8.5 wins) → `winningTeam`. See §3.1 note.
- **UI:** A "hot team" badge when `winningTeam` is true; filter "only players on winning teams." Optionally show the two sub-signals on the card (e.g. "2025: 11-6 ✓ / 2026 proj: 10.5 ✓").
- **Edge cases:** Win totals ship with the app and refresh yearly; allow manual override per team. If projected-wins data isn't loaded, fall back to the last-year record alone and label it as partial.

### 4.14 Position pecking order (depth chart) **[SHOULD]**

- **What:** Where a player sits on his NFL team's depth chart at his position.
- **Data:** Sleeper `depth_chart_order` / `depth_chart_position`.
- **UI:** "WR2 on DAL" style label on the card; a per-team depth view. Feeds the handcuff mapping (§4.16).
- **Edge cases:** Depth data can be noisy in preseason — label as estimated; allow manual note override.

### 4.15 Favorites (pre-draft) **[MUST]**

- **What:** Star players you like; quick-filter to your starred list on the clock.
- **Data:** `PersonalOverride.favorite` (shared across drafts).
- **UI:** Tap-to-star on any row; a "Favorites" filter/queue. Starred players get a visual marker in the main board even after the draft starts (until they're taken).
- **Edge cases:** Favorites persist across all drafts and across app restarts. A favorited player who gets drafted by someone else shows as "gone."

### 4.16 Do-not-draft list **[SHOULD]**

- **What:** Mark players you never want; they grey out so you skip them instantly.
- **Data:** `PersonalOverride.doNotDraft` (shared).
- **UI:** Toggle on the card; DND players rendered dimmed with a str/ban icon; option to hide entirely.
- **Edge cases:** DND and Favorite are mutually exclusive — toggling one clears the other (or warn). Shared across drafts.

### 4.17 Per-player notes **[SHOULD]**

- **What:** Free-text note on any player, visible on the card.
- **Data:** `PersonalOverride.note` (shared).
- **UI:** Editable note field on the player card; a note indicator icon on rows that have one.
- **Edge cases:** Notes persist across drafts. Reasonable length limit; no network needed.

### 4.18 Custom rank override (personal cheat sheet) **[SHOULD]**

- **What:** Drag players to reorder them into the user's own board, overriding default ranks.
- **Data:** `PersonalOverride.customRank` (shared).
- **UI:** A "My Board" view with drag-to-reorder; a toggle on the draft board to sort by "My Rank" vs ADP vs Projection. Edited players show a marker.
- **Edge cases:** New players (post-refresh) slot in by ADP until manually placed. Overrides persist across drafts and survive data refreshes (keyed by playerId, not row index).

### 4.19 Bye weeks **[SHOULD]**

- **What:** Show each player's bye; warn on stacking.
- **Data:** `Player.byeWeek`.
- **UI:** Bye column/badge; roster tracker (§4.7) surfaces conflicts.
- **Edge cases:** Null byes early in preseason — show "—".

### 4.20 Handcuff / backup mapping **[SHOULD]**

- **What:** Link starters to their backups (esp. RB handcuffs) and show team depth.
- **Data:** derived from depth chart (§4.14); `handcuffOfPlayerId`.
- **UI:** On a starter's card, "Handcuff: {backup}." A team depth view. Optional: highlight the handcuff of a player the user already drafted.
- **Edge cases:** Depth ambiguity in preseason; allow manual linking/override.

### 4.21 Strength of schedule **[COULD]**

- **What:** Season and fantasy-playoff SoS per player/team.
- **Data:** `sosSeason`, `sosPlayoffs` (derived/imported).
- **UI:** SoS badge on card; sortable. Show playoff-weeks SoS distinctly.
- **Edge cases:** Present as an estimate; don't over-weight visually.

### 4.22 Usage / target-share stats **[SHOULD]**

- **What:** Recent-season usage surfaced on the card for stats-driven picks.
- **Data:** `usage` from nflverse.
- **UI:** Card stats block: snap %, target share, carries, red-zone touches.
- **Edge cases:** Rookies/new roles lack history — note it.

### 4.23 Post-draft grid **[MUST]**

- **What:** After the draft, a grid of all teams × rounds showing who each team drafted.
- **Data:** `picks` + `teamNames`.
- **UI:** A scrollable/zoomable grid (teams as columns, rounds as rows) rendered for iPad. Snake ordering reflected. Highlight the user's team. Exportable as an image/PDF (see §4.25).
- **Edge cases:** Partial drafts render what exists. Must handle 12+ columns on an iPad screen (horizontal scroll / pinch-zoom).

### 4.24 Post-draft projections / team summary **[COULD]**

- **What:** After the draft, summarize each team's projected strength (sum of starters' projections) and per-position totals — "who won the draft on paper."
- **Data:** `picks` + `projPoints` + roster slots.
- **UI:** A table ranking teams by projected starter points; the user's team broken out by position with bye conflicts flagged.
- **Edge cases:** Requires projections to be imported; if absent, show pick-value-vs-ADP ("reaches and steals") instead, which needs only ADP.

### 4.25 Scoring & roster settings entry **[MUST]** (Yahoo import deferred)

- **What:** Enter league scoring rules and roster slots for a draft. **Manual form only** — Yahoo import is out of scope (Brandon opted out; see §2.6).
- **Data:** `Draft.settings.scoring` + `rosterSlots`.
- **UI:** On draft setup, a settings form: scoring format (default Full PPR, with PPR/half/standard/superflex presets and editable point values) and roster slots (default 1QB/2RB/2WR/1TE/K/DST, 6 bench, IR toggle). Presets make this two taps for the common case.
- **Edge cases:** Keep the settings layer abstracted so a Yahoo importer *could* prefill this form later without a rewrite, but build no Yahoo code now.

### 4.26 Data Refresh (prep) screen **[MUST]**

- **What:** The pre-draft action that pulls/normalizes all player data into the local dataset.
- **Data:** orchestrates §2 sources → `players` store.
- **UI:** A "Refresh Player Data" screen showing last-refresh timestamp, a big refresh button, per-source status (Sleeper ✓, ADP ✓, Projections: import CSV), and a CSV import dropzone for projections/contract-year/etc.
- **Edge cases:** Must be resilient — if one source fails, keep the others and report which failed. Warn if data is stale (e.g. ">2 days old") before a live draft. This is the only screen that requires network.

---

## 5. Screens / Navigation Map

1. **Home / Drafts list** — all drafts; create/open/duplicate/delete. (§4.2)
2. **Draft Setup** — name, teams, team names, my slot, scoring/roster settings (manual or Yahoo import). (§4.1, §4.25)
3. **Data Refresh** — prepare/refresh the player dataset; CSV import. (§4.26)
4. **My Board / Rankings** — custom rank drag-reorder, favorites, DND, notes (shared across drafts). (§4.15–4.18)
5. **Live Draft Board** — the core: player list, mark-drafted, undo/log, turn tracker, scarcity meter, tier alerts, roster tracker. (§4.3–4.7, plus filters/badges)
6. **Player Detail card** — stats, projection, injury, rookie/contract/winning-team badges, depth/handcuff, bye, SoS, usage, notes. (§4.9–4.22)
7. **Post-Draft** — grid + team projections/summary + export. (§4.23, §4.24)

Navigation should be iPad-friendly: a persistent side rail or top tabs; the Live Draft Board is the default screen once a draft is "live."

---

## 6. UX & Design Requirements

Modern, clean, calm design is a **first-class requirement**, not polish added at the end. The draft board is information-dense and used under time pressure, so the design job is to make the *right* information effortless to scan and the *primary* action effortless to hit. Favor clarity and restraint over decoration.

### 6.1 Design system (build this first, then compose screens from it)

- **Tokens, not one-off styles.** Define a single source of truth for color, spacing, typography, radius, shadow, and motion as tokens (CSS custom properties / Tailwind theme). Every screen composes from these — no hardcoded hex or magic pixel values scattered in components.
- **Spacing:** a consistent scale (e.g. 4/8/12/16/24/32). Generous whitespace; let rows breathe so they're scannable at a glance.
- **Typography:** the brand typeface is **Outfit** (the logo font) — use it for the wordmark, headings, and display text so the UI matches the mark. For dense body/data (player rows, stat tables) use a neutral system sans (system-ui) with **tabular figures** so numbers align; Outfit for labels/headers on top. One type scale with clear hierarchy (player name > team/pos > metrics). Bundle Outfit (OFL) with the app for offline use.
- **Color:** a restrained neutral base with a single accent, plus semantic colors for injury/tier/status. Full **light and dark themes** from the same tokens (dark mode matters — many drafts are evenings). For any chart, meter, tier ramp, or SoS heat, **follow the `dataviz` skill** for an accessible, consistent palette that holds up in both themes.
- **Components:** a small, consistent kit — player row, player card, badge, chip/filter, tier divider, segmented control, toast/snackbar, modal, empty/loading/error states. Reuse them everywhere so the app feels like one system.

### 6.1b Brand & logo

The app is **Fade Signal**. The name is the concept: "fade" is a football route, "signal" is cutting through noise to the data that matters.

- **Mark:** an **FS monogram** set in **Outfit Bold** — the F at full cap height in off-white, the S at ~78% cap height in amber, tops aligned, letters just kissing. Where the amber S meets the F, a **charcoal knockout outline** separates them for a layered, interlocked look. This is the definitive mark; reproduce it exactly, do not redraw the letters.
- **Assets provided (PNG):** app icons `icon-dark-{1024,512,192,180}.png` (primary), `icon-light-512.png`, `icon-mono-512.png` (single-color), and transparent wordmark lockups `lockup-light.png` / `lockup-dark.png`. The mark is composed from live Outfit glyphs, so the app can also render it in-code (see the knockout technique below) rather than shipping only rasters.
- **Knockout technique (for in-code rendering):** stack two S glyphs — a back layer stroked in the background color (charcoal on dark, off-white on light) to carve the separation, and a front layer filled amber. F is a single off-white (or ink) glyph beneath.
- **Wordmark:** "Fade Signal" in Outfit Bold, ink on light / off-white on dark, letter-spacing ≈ −0.03em. The mark's amber lives in the icon; the wordmark itself is single-color for a clean, premium read.
- **Usage rules:** clear space around the lockup ≥ the height of the F's top arm; minimum icon size 24px (below ~64px use the icon alone, drop the wordmark); use `icon-dark-*` for the iOS home screen (`apple-touch-icon`) and PWA manifest (192/512), generate favicons from `icon-dark-512.png`; use `icon-mono-512.png` for one-color contexts.
- These brand colors **are** the design-system color tokens — see §6.1c.

### 6.1c Color tokens (from the brand)

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#202327` | Charcoal — primary text (light theme), tile/base (dark theme), icon background |
| `--accent` | `#E7A23B` | Amber — brand accent (the S, key highlights). Use **on charcoal**; see contrast note |
| `--accent-strong` | `#CE8A28` | Deeper amber for pressed/active states |
| `--surface` | `#F4F5F6` | Off-white — light panels, the knockout color on light, the F on dark |

Key rules: **amber is a brand/accent color, not a text color on white** — amber on white fails WCAG AA for body text, so use amber against charcoal (where it passes) or reserve it for fills, the mark, icons, and large non-text accents; for interactive text/controls that need color, pair amber fills with ink labels or use ink-on-amber (which passes). Charcoal (`--ink`) and off-white (`--surface`) carry all body text and surfaces and give AA contrast in both themes. Semantic colors (injury/tier/status, chart ramps) are defined per the `dataviz` skill and must stay distinct from amber.

### 6.2 Touch & layout (iPad-native)

- **Landscape-first**, but support portrait and iPadOS split-view/Stage Manager gracefully (responsive, no fixed widths that break).
- **Touch targets ≥44×44px**; comfortable hit areas with spacing so you don't misfire while distracted.
- **Reachability:** put the most-used actions (mark drafted, undo, search) where thumbs actually are — a bottom or side action zone, not only the top bar. Assume one hand, divided attention.
- **Respect safe-area insets** and standalone PWA chrome; no content under the notch/home indicator.

### 6.3 Speed & responsiveness

- **Marking a pick is ≤2 taps and instant** — optimistic UI, no spinner, immediate visual confirmation.
- **Virtualize long lists.** The player pool is 300+ rows; render with a virtualized list so scrolling stays 60fps and search feels instant.
- **Perceived performance:** skeleton/placeholder states during the one online prep step; never a blank white screen.

### 6.4 Interaction & feedback

- **Gestures** where they speed things up: swipe a row to favorite / mark do-not-draft, drag to reorder in My Board, pull-to-refresh only on the prep screen (never mid-draft).
- **Haptic + visual feedback** on key actions (pick made, undo) for confidence without looking closely.
- **Undo-first for destructive actions:** deleting a pick or draft shows an undo snackbar rather than a scary confirm dialog where possible; reserve confirm modals for truly irreversible things.
- **Motion:** subtle, functional, fast (150–250ms); honor `prefers-reduced-motion`.

### 6.5 Information design for the board

- **Scannable rows:** name and the two or three metrics that matter most, with secondary detail on the card (progressive disclosure — tap for the full player card).
- **Consistent badges:** injury / rookie / bye / tier / winning-team always look the same everywhere. **Never rely on color alone** — pair every color signal with an icon or text label (accessibility + glanceability).
- **Search & filter** always reachable: fuzzy name search plus filters (position, tier, favorites, hide-drafted, hide-Out/IR, rookies-only). Filters should be one tap and show active state clearly.
- **Clear states:** thoughtful empty states ("No favorites yet — tap ★ on any player"), loading states, and human error messages (never a raw stack trace).

### 6.6 Accessibility (WCAG 2.1 AA target)

- **Contrast** meets AA in both themes; verify with a checker.
- **Dynamic Type:** respect the iPad's text-size setting; layouts reflow without clipping.
- **VoiceOver:** meaningful labels on controls and player rows (e.g. "Bijan Robinson, RB, Atlanta, ADP 3, drafted" states announced).
- **Color-independence, reduced motion, focus states** for external keyboard use.

### 6.7 Offline & trust cues

- **Offline-first UX:** never block on network during a draft; a subtle, non-alarming indicator ("Offline — data as of {date}") instead of errors.
- **Freshness always visible** on data-derived screens so the user trusts what they're seeing.

---

## 7. Non-Functional Requirements

- **Robustness:** a network failure at any moment must not lose draft state or block marking picks. Persist every pick to IndexedDB immediately.
- **Data freshness stamp:** every screen sourced from prepared data shows "as of {timestamp}."
- **Portability of personal data:** provide an **export/import of the user's personal rankings, notes, favorites, DND** (JSON) so they survive device changes and reinstalls.
- **No secrets in the frontend:** any Yahoo client secret lives only in the serverless function.
- **Respect source limits:** cache the Sleeper player dump (fetch ≤1×/day); parameterize and cache ADP. Don't hammer any endpoint.
- **Legal:** prefer official/public endpoints and user-provided CSVs over scraping. Do not ship a scraper that violates a site's ToS as a hard dependency.

---

## 7b. Security & Hardening

Because there is **no backend and no accounts**, this app's attack surface is small — but "local" is not the same as "safe." The realistic threats are: malicious or malformed **imported files** (the CSV/JSON import paths), **supply-chain risk** from npm/CDN dependencies, **injection/XSS** through rendered player data and notes, and a **broken or poisoned offline cache**. Harden against these; don't over-engineer encryption for non-sensitive fantasy data.

### 7b.1 App delivery & headers
- **HTTPS only.** Service workers and PWA install require it; host on HTTPS (the app is static, so any static host works).
- **Strict Content-Security-Policy.** Disallow inline scripts and `eval`; `default-src 'self'`. Whitelist only the specific data origins the prep step calls (Sleeper, FFCalc). No wildcard sources.
- **Bundle everything; no runtime CDN.** Vendor all libraries into the build rather than loading from a CDN at runtime. If any third-party script must be remote, pin it with **Subresource Integrity (SRI)**. Fewer moving parts = smaller supply-chain surface and better offline reliability.
- Standard hardening headers where the host allows: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy` (deny camera/mic/geolocation — the app needs none).

### 7b.2 Untrusted input — the main risk
- **CSV/JSON import is the primary untrusted-input vector.** Validate everything:
  - Enforce a **size limit** and expected structure; reject/skip malformed rows with a clear report rather than crashing.
  - Parse with a real CSV parser (e.g. PapaParse) — **never `eval`** or hand-rolled string execution.
  - **Guard against CSV/formula injection:** treat all cell values as data; when a value begins with `=`, `+`, `-`, or `@`, do not let it be interpreted as a formula anywhere, and neutralize it if the data is ever re-exported.
  - Coerce/whitelist types (numbers are numbers, positions are from the known enum); drop unknown columns.
- **Validate imported personal-data JSON** (the rankings/notes export) against a schema before merging; never trust it to be well-formed.
- **Validate API responses** from Sleeper/FFCalc before writing to the store — check shape and types, set request **timeouts**, and fail soft (keep prior good data) on garbage responses. Don't follow arbitrary redirects.

### 7b.3 Output safety (XSS)
- Player names, team notes, and any imported text are rendered throughout. **Rely on the framework's auto-escaping** (React/Vue escape by default) and **never** use `dangerouslySetInnerHTML` / `v-html` / `innerHTML` with player or user-entered content.
- Notes are plain text, not HTML. If any rich rendering is ever added, sanitize with a vetted library (DOMPurify) — not a regex.

### 7b.4 Local data at rest
- Data stored (IndexedDB) is **low-sensitivity** (public player data + your own rankings/notes) and lives in the iOS app sandbox, which is isolated per-origin and protected by the device passcode. **Encryption at rest is not required**; don't add complexity that buys little.
- **Do** provide the personal-data **export/import** (§7) so the user isn't locked in and can back up off-device.
- **No secrets in the app at all** — there's no Yahoo key, no token, nothing to leak. Keep it that way; if Yahoo is ever added, its secret stays server-side (§2.6).

### 7b.5 Service worker & cache integrity
- Scope the service worker tightly; use a **versioned cache** with a clear update strategy so a bad deploy can't strand the user on broken cached code. Purge old caches on activate.
- Cache the app shell and the last-good player dataset; a failed refresh must **never** overwrite good cached data with partial/garbage data (write new data only after full validation).

### 7b.6 Privacy & supply chain
- **No telemetry, analytics, ads, or third-party trackers.** All data stays on device; make that a hard rule.
- **Dependency hygiene:** minimal dependencies, a committed lockfile, `npm audit` (or equivalent) in the build, and periodic updates. Prefer well-maintained, widely-used libraries over niche ones.
- Keep the dependency count low on purpose — every package is attack surface and offline-bloat.

---

## 8. Suggested Build Order (Milestones)

1. **M1 — Skeleton + design system + local storage:** PWA shell (HTTPS, strict CSP, service worker), **the design-system tokens/components from §6.1 built first**, IndexedDB, drafts list, create/open a draft with team names + slot (§4.1–4.2). Establishing the design system and security baseline here means every later screen inherits both for free.
2. **M2 — Data pipeline:** Data Refresh screen pulling Sleeper + FFCalc ADP into `players`, with CSV import for projections (§4.26, §2). Offline caching.
3. **M3 — Live draft board core:** player list, mark-drafted, on-the-clock defaulting, undo, draft log with edit/correct (§4.3), turn tracker (§4.6).
4. **M4 — Decision aids:** roster tracker (§4.7), scarcity meter (§4.5), tiers + alerts (§4.4), value metrics (§4.8).
5. **M5 — Player context:** detail card with injury/rookie/bye/depth/handcuff/usage/SoS badges + filters (§4.9–4.22).
6. **M6 — Personal board:** favorites, DND, notes, custom rank drag-reorder, shared across drafts (§4.15–4.18).
7. **M7 — Post-draft:** grid + team projection summary + export (§4.23–4.24).
8. **M8 — (Deferred) Yahoo:** not in this build. Left as a future option only.

Ship M1–M3 first — that alone is a usable draft tool. Everything after is additive.

---

## 8b. Testing & QA Requirements

This app will be **fully tested and QA'd before it's trusted in a live draft.** Build it test-first where practical and ship it with an automated test suite plus a manual draft-day dry-run checklist. The cost of a bug here is a botched pick you can't take back, so correctness of the draft logic and resilience offline are the priorities.

**Automated tests (unit + integration):**
- **Snake-order math** — for 8/10/12/14 teams, verify the on-the-clock team and every "your next pick" number across all rounds, including the reversal at each turn. This is the highest-risk logic.
- **Pick log + correction** — drafting, undo, editing a past pick, deleting a pick, and returning a player to the pool must each recompute *all* derived state (turn tracker, best available, roster tracker, scarcity, tiers) correctly. Property-test: after any sequence of picks/corrections, no player appears twice and counts reconcile.
- **Roster tracker** — slot-filling for the default lineup (1QB/2RB/2WR/1TE/K/DST, no FLEX) plus FLEX/SUPERFLEX/IR variants; bye-stack warnings trigger on the right thresholds.
- **VORP / replacement levels / auction $** — recompute from league settings, not hardcoded; verify values shift correctly when team count or roster slots change.
- **Tiers & scarcity** — remaining-in-tier and remaining-quality counts decrement correctly as players are drafted.
- **Data normalization** — each source adapter (Sleeper, FFCalc ADP, CSV projections) maps to the `Player` model; malformed/missing fields degrade gracefully (nulls, not crashes).
- **Persistence** — every pick survives a mid-draft reload from IndexedDB; personal rankings/notes/favorites survive a data refresh (keyed by playerId).

**Offline / resilience tests (critical):**
- Load the app, go fully offline (airplane mode), and run a complete mock draft start to finish — marking, undo, correction, post-draft grid — with **zero** network calls in the draft hot path.
- Kill and relaunch the app mid-draft; state restores exactly.
- One data source failing during prep doesn't block the others; the app reports which failed.

**Security tests (see §7b):**
- Import a malformed / oversized CSV and a CSV with formula-injection payloads (`=`, `+`, `-`, `@` leading cells) — app rejects/neutralizes safely, no crash, no formula execution, clean re-export.
- Import malformed personal-data JSON — schema validation rejects it without corrupting existing data.
- Feed a garbage/timeout API response during prep — prior good cached data is preserved, failure reported.
- Render a player name/note containing HTML/script — it displays as literal text (no XSS).
- Confirm CSP blocks inline scripts; confirm no runtime CDN calls; `npm audit` clean.
- Failed data refresh does not overwrite the last-good cached dataset.

**Device / UX / accessibility tests:**
- Real iPad, Safari, landscape and portrait; installed-to-home-screen PWA.
- Mark-a-pick is ≤2 taps and feels instant (no spinner) with a full player dataset loaded.
- 12+ team post-draft grid is legible/scrollable on the iPad screen.
- Light and dark mode both pass (see `dataviz` skill for the color system).

**Pre-draft dry-run checklist (manual, run before each real draft):**
1. Refresh player data; confirm the "as of" timestamp is recent (< 2 days).
2. Confirm draft settings: team count, your slot, scoring, roster slots.
3. Run a 2–3 round mock against the actual board; test one undo and one pick-correction.
4. Verify your favorites / do-not-draft / custom ranks loaded.
5. Put the device in airplane mode and confirm the board still works, then restore.

---

## 9. Out of Scope (Do NOT Build)

- In-season weekly lineup setting, live game-day scoring, waivers, trades, matchup tracking.
- **Yahoo integration / any backend** — not in this build (Brandon opted out). The app is fully static + local.
- Real-money features, multi-user accounts, or server-side storage of the user's data.
- A full player news wire (only best-effort buzz/injury signals per §2.5).
- Automated contract-year scraping (manual/CSV only).

---

## 10. Resolved Decisions (confirmed with Brandon, Aug 2026)

1. **"On a winning team"** — **two-part flag:** team was above .500 in 2025 **AND** projected to win in 2026. Both required. (See §4.13.)
2. **Projections source** — **annual CSV import** (FantasyPros export or similar). No automated scraping. (See §2.3.)
3. **Yahoo** — **not building it.** Manual settings only, **no backend**, fully static + offline. (See §2.6, §4.25.)
4. **Auction values** — **keep them** as a cross-position comparison metric despite snake format. (See §4.8.)
5. **Roster slots** — main league starting lineup is **1QB / 2RB / 2WR / 1TE / K / DST (no FLEX)**, **6 bench**, with an **IR slot in some leagues** (make bench/IR configurable per draft). This sets the default roster tracker and VORP replacement levels. (See §3.3.)
