# Card Playing Suite (Working Name)

Browser-first card game suite with shared UI, shared gameplay utilities, and mobile-friendly interaction patterns.
Current repository name is `bj_table` (subject to be renamed appropriately).

## Quick Start

No build step is required.

- Open `src/index.html` directly, or
- Serve statically: `python3 -m http.server` and open `http://localhost:8000/src/`.
- Runtime web assets are sourced from `src/` (root `index.html` only redirects to `src/index.html`).

The project is designed to run from both static hosting and `file://`.

## Included Games

- Blackjack (`src/blackjack.html`)
- Texas Hold'em (`src/poker.html`)
- Klondike Solitaire (`src/klondike.html`)
- FreeCell (`src/freecell.html`)
- Spider Solitaire (`src/spider.html`)
- Simple Simon (`src/simple-simon.html`)
- Forty Thieves / Napoleon at St. Helena (`src/forty-thieves.html`)
- Rush Hour Patience (`src/rush-hour-patience.html`)
- Pyramid Solitaire (`src/pyramid.html`)
- Dark Pyramid (`src/dark-pyramid.html`)
- Golf Solitaire (`src/golf.html`)
- Baker's Dozen Solitaire (`src/bakers-dozen.html`)
- TriPeaks Solitaire (`src/tripeaks.html`)
- Table Top Sandbox (`src/tabletop.html`)
- And potentially other card games.

## Split App Profiles (Suite, Casino, Solitaire)

The codebase now supports a lightweight launcher profile switch for separate app bundles while preserving shared systems:

- `suite`: full launcher (casino + solitaire + sandbox)
- `casino`: launcher focused on Blackjack and Texas Hold'em Poker
- `solitaire`: launcher focused on solitaire variants (including Klondike, FreeCell, Spider, Pyramid/Dark Pyramid, Golf variants) plus Table Top Sandbox (experimental)

Profile selection writes `src/app-profile.js`, which `src/index.html` reads at runtime.
The same profile also filters Store listings so split apps avoid out-of-audience add-ons.
Android flavors now map these profiles to distinct app IDs:

- `suite`: `com.antisthenes.bundle`
- `casino`: `com.antisthenes.casino`
- `solitaire`: `com.antisthenes.solitaire`

Current flavor launcher labels:

- `suite`: `Card Bundle`
- `casino`: `House of Fortune Collection`
- `solitaire`: `Virtue Solitaire Collection`

Commands:

- `npm run profile:suite`
- `npm run profile:casino`
- `npm run profile:solitaire`

## Variants and Game Options

- Klondike: Classic Klondike, Vegas Klondike, Open Towers, Draw 1 / Draw 3 (variant-dependent lock rules).
- Spider: 4-Suit, 2-Suit, and 1-Suit modes, plus Simple Simon as a dedicated variant page.
- Forty Thieves: Napoleon (Forty Thieves), Josephine, Alibaba, Thieves of Egypt, Rank and File selectable in game settings.
- Rush Hour Patience: Taxi-contract variant with short/long suit contracts, rush-hour draw escalation, optional taxi stands, and optional Joker rule toggles.
- TriPeaks: Classic, Strict (no wrap), Relaxed (wrap + same-rank), Open (all peaks face-up) selectable in game settings.
- Pyramid: Draw 1 / Draw 3.
- Dark Pyramid: Pyramid rules with blocked cards hidden.
- Golf: Classic (wrap-around), Strict (no wrap), Mini (7x4, no wrap), Long (7x6, wrap-around) selectable in game settings.
- Blackjack: seats (1-9), decks (1-8), configurable table minimum bet, and per-seat persona save/load controls.
- Table Top Sandbox: configurable deck count, deck groups, center piles, and foundation counts.

## Shared Architecture

- `src/common.js`: shared card/deck utilities, responsive sizing helpers, toasts/audio helpers, and `StateManager`.
- `src/header.js`: shared header toggle/collapse behavior.
- `src/shared/mobile-controller.js`: shared mobile touch logic for pick-up and panning coordination.
- `src/shared/ui-helpers.js`: shared hit-testing and pointer utility helpers.
- `src/shared/solitaire-ui-feedback.js`: shared solitaire help/hint/outcome feedback wrapper (modal-first with toast fallback).
- `src/shared/entitlements.js`: canonical local entitlement store with claim metadata and authoritative-merge APIs.
- `src/shared/entitlement-sync.js`: lifecycle-aware entitlement sync runner (native bridge first, debug mock fallback).
- `src/addons.js` + `src/addons/manifest.js`: add-on loading and add-on catalog registration.
- `src/app-profile.js`: build-selected app profile consumed by the launcher to expose audience-specific game groups.
- `src/styles/core.css`, `src/styles/layout.css`, `src/styles/mobile.css`: shared base, layout, and mobile override style layers.

## Persistence

Solitaire games and Blackjack persist state with `localStorage` via `CommonUtils.StateManager`.

- Keys are namespaced as `bj_table.save.<gameId>`.
- State is marked dirty on moves and saved on interval/page lifecycle events.
- Winning a game clears that game’s save.
- Restores happen automatically on page load when a valid save exists.
- Blackjack restore keeps seated players, balances, and table statistics; the shoe/deal flow restarts from a fresh betting shoe.
- Blackjack includes a `Reset Statistics` action that zeroes table/player statistics while keeping seated players in place.
- Blackjack personas are stored separately (`bj_table.blackjack_personas`) so `Reset Statistics` does not remove saved personas.
- Solitaire high scores are tracked per game and per active ruleset in local storage (`bj_table.high_scores`) and shown in each game’s stats panel.

## Mobile and Responsive Behavior

- Horizontal scrolling is enabled only when content actually overflows.
- Game tables center when there is extra horizontal space.
- Header controls are responsive and avoid overlap with back button/title/menu toggles.
- Blackjack shoe is hidden on phones and on larger viewports only when it cannot fit cleanly without overlapping gameplay content; when visible but near center, dealer content shifts slightly to share space.
- Blackjack table height expands when scaled content would otherwise clip seat controls.
- Solitaire drag/drop supports mobile panning while a card is selected.

## Add-ons and Themes

- Add-on catalog is defined in `src/addons/manifest.js`.
- `src/addons.js` supports script manifest (`window.AddonManifest`), legacy inline manifest, and network fallback to `addons/manifest.json` when not on `file://`.
- Add-ons only appear/load after entitlement claim.
- Add-ons may include a `games` allow-list so packs only appear in supported game pages.

## Entitlements Boundary (Local Now, Play-Ready Later)

- Canonical local entitlement state is stored by `window.EntitlementStore` in `localStorage` (`bj_table.entitlements.v2`).
- Claims carry provenance metadata (`ownership`, `source`) so local claims and future Play/backend authoritative claims are explicit.
- `src/shared/entitlement-sync.js` runs on startup and app foreground/resume and applies authoritative claims via:
  - `EntitlementStore.applyAuthoritativeClaims(ids, options)`
- Current source priority:
  1. Native bridge payload (when available)
  2. Debug mock payload (`localStorage` key: `bj_table.entitlements.authoritative_mock.v1`)
  3. Local claims only

## Tests

Current logic tests are plain Node scripts:

- `node src/logic.test.js`
- `node src/poker-logic.test.js`
- `node src/solitaire-logic.test.js`

Guidance:
- Run logic tests when gameplay rules, persistence, shared systems, or input handling changes.
- For rendering-only changes (CSS/layout/markup) with no behavior impact, targeted visual checks are usually sufficient.

## Documentation to Keep Updated

When behavior or architecture changes substantially, keep these files in sync:

- `AGENTS.md` for engineering constraints, shared systems map, and QA smoke checklist
- `README.md` for project overview, runtime expectations, and current feature set
- `ARCHITECTURE.md` for shared-system boundaries and runtime contracts
- `QA_SMOKE.md` for cross-game verification steps
- `ROADMAP.md` for sequencing, mobile deployment goals, and monetization milestones

## Android Wrapper Notes

- Capacitor wrapper progress and resume instructions are documented in `mobile/android/README.md`.
- Developer shortcut scripts live in `scripts/`.
- Native entitlement bridge stub is currently provided by `android/app/src/main/java/com/antisthenes/bundle/EntitlementBridgePlugin.java`.

## Android Developer Shortcuts

From repo root:

- `npm run android:doctor`: verify Java/SDK/ADB and installed Capacitor packages.
- `npm run cap:sync`: sync `src/` web assets into the Android project.
- `npm run android:build:debug`: build debug APK.
- `npm run android:suite:build:debug`: apply `suite` profile, sync, then build debug APK.
- `npm run android:casino:build:debug`: apply `casino` profile, sync, then build debug APK.
- `npm run android:solitaire:build:debug`: apply `solitaire` profile, sync, then build debug APK.
- `npm run android:suite:bundle:release`: build `suite` Play bundle (`.aab`).
- `npm run android:casino:bundle:release`: build `casino` Play bundle (`.aab`).
- `npm run android:solitaire:bundle:release`: build `solitaire` Play bundle (`.aab`).
- `npm run android:install:connected`: install debug APK to an authorized connected device.
- `npm run android:casino:install:connected`: install casino debug APK.
- `npm run android:solitaire:install:connected`: install solitaire debug APK.
- `npm run android:rebuild:deploy`: full loop (`npm install`, sync, clean build, deploy).

### Fast Iteration Guidance

- For minor web-only prototyping (HTML/CSS/JS under `src/`) use local browser/file validation first and skip Android sync/build.
- Run `npm run cap:sync` only when Android assets must be refreshed for device validation.
- Run `npm run android:build:debug` / install only when native changes are involved or an APK/device retest is required.
