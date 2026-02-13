# Architecture Overview

## Purpose
This document describes shared systems, boundaries, and runtime contracts so new games can be added without duplicating logic.
The repository is currently named `bj_table` (subject to be renamed appropriately).

## Runtime Model
- Browser-first static app.
- Must work from `file://` and static hosting.
- No server/runtime dependency required for core gameplay.
- Android native wrapper support is provided via Capacitor with `src/` as `webDir`.
- Android audience split is implemented through flavors with distinct app IDs (`suite`, `casino`, `solitaire`) while sharing one web codebase.

## Entry Points
- `src/index.html`: launcher page.
- Game pages: `src/blackjack.html`, `src/poker.html`, `src/klondike.html`, `src/freecell.html`, `src/spider.html`, `src/pyramid.html`, `src/tabletop.html`.
- Additional card game pages may be added over time.

## Shared Systems
- `src/common.js`: shared card/deck helpers, responsive sizing helpers, toast/audio helpers, high-score storage helpers, and `StateManager`.
- `src/header.js`: shared header control registration and collapse/expand behavior.
- `src/shared/mobile-controller.js`: mobile card interaction controller for pick/drag/drop + panning coexistence.
- `src/shared/ui-helpers.js`: shared hit-testing and pointer-target helpers.
- `src/shared/solitaire-insolvability.js`: shared rapid insolvability detector for solitaire deal filtering, with variant-specific forbidden-subgraph matchers.
- `src/shared/solitaire-solvability.js`: shared bounded forward-search solvability checker that evaluates if a current solitaire state can still reach a win.
- `src/shared/solitaire-check-modal.js`: shared solitaire modal primitive for long-running check progress, result presentation, and confirmation prompts.
- `src/shared/solitaire-check-worker.js`: dedicated worker runtime for FreeCell and Klondike check flows so long searches do not block the main thread.
- `src/shared/entitlements.js`: canonical local entitlement store with claim metadata (`ownership`, `source`, timestamps) and authoritative merge hooks.
- `src/shared/entitlement-sync.js`: app lifecycle sync runner that pulls authoritative claims from a native bridge (or debug mock) and applies them through the entitlement store.
- `src/addons.js` + `src/addons/manifest.js`: addon manifest ingestion and addon loading/toggling.
- `src/app-profile.js`: build-selected app profile consumed by launcher/store flows to expose audience-specific game groups for split app packaging.
- `src/styles/core.css`, `src/styles/layout.css`, `src/styles/mobile.css`: shared base/layout/mobile styles.

## Layout and Responsiveness Contract
- Tables are wrapped in `.table-scroll` containers.
- Horizontal scrolling is enabled only when required by content width.
- Tables should center when there is spare width.
- Blackjack shoe visibility is fit-driven: hide the shoe when it cannot fit cleanly inside the table without overlapping dealer/seat content.
- Blackjack dealer alignment is fit-aware: when the shoe remains visible but encroaches near center, dealer content may shift slightly off center to preserve usable space.
- Blackjack table height must grow when scaled content exceeds the default table cap so seat controls remain reachable.
- Headers should prevent overlap between back button, title, and toggle buttons.
- Mobile overrides are loaded last (`src/styles/mobile.css`).
- Launcher card exposure is profile-driven by `window.AppProfile.launcherGroups` so split bundles can target different audiences without forking game pages.
- Store add-on exposure is profile-driven by `window.AppProfile.storeGameFilter` so split bundles can hide out-of-audience content (for example, blackjack counting packs in solitaire-only builds).

## Test Scope Guidance
- Gameplay and persistence tests are required when rule logic, save-state behavior, shared systems, or input handling changes.
- Rendering-only changes (CSS/layout/markup) should default to targeted visual verification; full logic test suites are optional unless behavior contracts changed.

## Persistence Contract
- Use `CommonUtils.StateManager`.
- Save key format: `bj_table.save.<gameId>`.
- State should be marked dirty after meaningful moves.
- Saves flush on interval and page lifecycle events.
- On win, clear save state.
- Solitaire high scores are stored separately under `bj_table.high_scores`, keyed by game + ruleset.
- Blackjack persists session-level state (seated players, balances, and table statistics) and intentionally resets active dealing/shoe flow to a fresh betting shoe on restore.
- Blackjack provides a user-facing reset action that resets statistics without removing currently seated players.

## Add-ons Contract
- Primary source: `window.AddonManifest` from `src/addons/manifest.js`.
- `src/addons.js` supports legacy inline JSON manifest tags for compatibility.
- Network fallback to `addons/manifest.json` should only be attempted when protocol is not `file:`.
- Add-ons are loaded only when their IDs are claimed in `window.EntitlementStore`.
- Add-ons are additionally filtered by optional manifest `games` allow-list.

## Entitlements Contract
- Local canonical store: `window.EntitlementStore` (`src/shared/entitlements.js`), persisted in `localStorage` key `bj_table.entitlements.v2`.
- Claim records include source-of-truth metadata:
  - `ownership`: `default`, `local`, or `authoritative`.
  - `source`: provenance label (for example `system-default`, `store-claim`, `play-billing-backend`).
- Default claim: `default-themes` is always present.
- Future Play/backend boundary is explicit:
  - Native/backend sync should call `EntitlementStore.applyAuthoritativeClaims(...)`.
  - Authoritative claims are applied by `src/shared/entitlement-sync.js` on startup and app resume/foreground transitions.
  - Android baseline bridge surface is `window.Capacitor.Plugins.EntitlementBridge.getAuthoritativeClaims()`.
- Debug authoritative feed for local testing:
  - `localStorage` key `bj_table.entitlements.authoritative_mock.v1`
  - shape: `{ "ids": ["addon-id"], "revision": "optional-string" }`

## Extension Guidance
- New game pages should consume shared header, shared styles, and shared helpers first.
- Avoid per-game one-off responsiveness logic when shared helpers can be extended.
- If new shared systems are added, update `AGENTS.md`, `README.md`, and this file.
- Developer workflow shortcuts for Android are maintained in `scripts/`.
