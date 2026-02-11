# Architecture Overview

## Purpose
This document describes shared systems, boundaries, and runtime contracts so new games can be added without duplicating logic.
The repository is currently named `bj_table` (subject to be renamed appropriately).

## Runtime Model
- Browser-first static app.
- Must work from `file://` and static hosting.
- No server/runtime dependency required for core gameplay.

## Entry Points
- `index.html`: launcher page.
- Game pages: `blackjack.html`, `poker.html`, `klondike.html`, `freecell.html`, `spider.html`, `pyramid.html`, `tabletop.html`.
- Additional card game pages may be added over time.

## Shared Systems
- `common.js`: shared card/deck helpers, responsive sizing helpers, toast/audio helpers, and `StateManager`.
- `header.js`: shared header control registration and collapse/expand behavior.
- `shared/mobile-controller.js`: mobile card interaction controller for pick/drag/drop + panning coexistence.
- `shared/ui-helpers.js`: shared hit-testing and pointer-target helpers.
- `addons.js` + `addons/manifest.js`: addon manifest ingestion and addon loading/toggling.
- `styles/core.css`, `styles/layout.css`, `styles/mobile.css`: shared base/layout/mobile styles.

## Layout and Responsiveness Contract
- Tables are wrapped in `.table-scroll` containers.
- Horizontal scrolling is enabled only when required by content width.
- Tables should center when there is spare width.
- Headers should prevent overlap between back button, title, and toggle buttons.
- Mobile overrides are loaded last (`styles/mobile.css`).

## Persistence Contract (Solitaire Games)
- Use `CommonUtils.StateManager`.
- Save key format: `bj_table.save.<gameId>`.
- State should be marked dirty after meaningful moves.
- Saves flush on interval and page lifecycle events.
- On win, clear save state.

## Addons Contract
- Primary source: `window.AddonManifest` from `addons/manifest.js`.
- `addons.js` supports legacy inline JSON manifest tags for compatibility.
- Network fallback to `addons/manifest.json` should only be attempted when protocol is not `file:`.

## Extension Guidance
- New game pages should consume shared header, shared styles, and shared helpers first.
- Avoid per-game one-off responsiveness logic when shared helpers can be extended.
- If new shared systems are added, update `AGENTS.md`, `README.md`, and this file.
