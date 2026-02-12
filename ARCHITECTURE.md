# Architecture Overview

## Purpose
This document describes shared systems, boundaries, and runtime contracts so new games can be added without duplicating logic.
The repository is currently named `bj_table` (subject to be renamed appropriately).

## Runtime Model
- Browser-first static app.
- Must work from `file://` and static hosting.
- No server/runtime dependency required for core gameplay.

## Entry Points
- `src/index.html`: launcher page.
- Game pages: `src/blackjack.html`, `src/poker.html`, `src/klondike.html`, `src/freecell.html`, `src/spider.html`, `src/pyramid.html`, `src/tabletop.html`.
- Additional card game pages may be added over time.

## Shared Systems
- `src/common.js`: shared card/deck helpers, responsive sizing helpers, toast/audio helpers, high-score storage helpers, and `StateManager`.
- `src/header.js`: shared header control registration and collapse/expand behavior.
- `src/shared/mobile-controller.js`: mobile card interaction controller for pick/drag/drop + panning coexistence.
- `src/shared/ui-helpers.js`: shared hit-testing and pointer-target helpers.
- `src/addons.js` + `src/addons/manifest.js`: addon manifest ingestion and addon loading/toggling.
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

## Extension Guidance
- New game pages should consume shared header, shared styles, and shared helpers first.
- Avoid per-game one-off responsiveness logic when shared helpers can be extended.
- If new shared systems are added, update `AGENTS.md`, `README.md`, and this file.
