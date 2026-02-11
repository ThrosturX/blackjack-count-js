# Card Playing Suite (Working Name)

Browser-first card game suite with shared UI, shared gameplay utilities, and mobile-friendly interaction patterns.
Current repository name is `bj_table` (subject to be renamed appropriately).

## Quick Start

No build step is required.

- Open `index.html` directly, or
- Serve statically: `python3 -m http.server` and open `http://localhost:8000`.

The project is designed to run from both static hosting and `file://`.

## Included Games

- Blackjack (`blackjack.html`)
- Texas Hold'em (`poker.html`)
- Klondike Solitaire (`klondike.html`)
- FreeCell (`freecell.html`)
- Spider Solitaire (`spider.html`)
- Pyramid Solitaire (`pyramid.html`)
- Table Top Sandbox (`tabletop.html`)
- And potentially other card games.

## Variants and Game Options

- Klondike: Classic Klondike, Vegas Klondike, Open Towers, Draw 1 / Draw 3 (variant-dependent lock rules).
- Spider: 4-Suit, 2-Suit, and 1-Suit modes.
- Pyramid: Draw 1 / Draw 3.
- Blackjack: seats (1-9), decks (1-8), configurable table minimum bet.
- Table Top Sandbox: configurable deck count, deck groups, center piles, and foundation counts.

## Shared Architecture

- `common.js`: shared card/deck utilities, responsive sizing helpers, toasts/audio helpers, and `StateManager`.
- `header.js`: shared header toggle/collapse behavior.
- `shared/mobile-controller.js`: shared mobile touch logic for pick-up and panning coordination.
- `shared/ui-helpers.js`: shared hit-testing and pointer utility helpers.
- `addons.js` + `addons/manifest.js`: add-on loading and add-on catalog registration.
- `styles/core.css`, `styles/layout.css`, `styles/mobile.css`: shared base, layout, and mobile override style layers.

## Persistence

Solitaire games currently persist in-progress state with `localStorage` via `CommonUtils.StateManager`.

- Keys are namespaced as `bj_table.save.<gameId>`.
- State is marked dirty on moves and saved on interval/page lifecycle events.
- Winning a game clears that game’s save.
- Restores happen automatically on page load when a valid save exists.

## Mobile and Responsive Behavior

- Horizontal scrolling is enabled only when content actually overflows.
- Game tables center when there is extra horizontal space.
- Header controls are responsive and avoid overlap with back button/title/menu toggles.
- Blackjack shoe is hidden on phones and visible on tablets/desktop.
- Solitaire drag/drop supports mobile panning while a card is selected.

## Add-ons and Themes

- Add-on catalog is defined in `addons/manifest.js`.
- `addons.js` supports script manifest (`window.AddonManifest`), legacy inline manifest, and network fallback to `addons/manifest.json` when not on `file://`.

## Tests

Current logic tests are plain Node scripts:

- `node logic.test.js`
- `node poker-logic.test.js`
- `node solitaire-logic.test.js`

## Documentation to Keep Updated

When behavior or architecture changes substantially, keep these files in sync:

- `AGENTS.md` for engineering constraints, shared systems map, and QA smoke checklist
- `README.md` for project overview, runtime expectations, and current feature set
- `ARCHITECTURE.md` for shared-system boundaries and runtime contracts
- `QA_SMOKE.md` for cross-game verification steps
- `ROADMAP.md` for sequencing, mobile deployment goals, and monetization milestones
