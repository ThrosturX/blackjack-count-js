# QA Smoke Checklist

## When To Run
- Before release.
- After major UI/layout changes.
- After touch/drag logic changes.
- After shared system refactors.

## Global Checks
- Every page loads with no console errors.
- Header menus collapse/expand correctly.
- Back button, title, and menu toggles do not overlap.
- No unnecessary horizontal scrolling when content fits.
- Horizontal scrolling works when content does not fit.
- Works from both static hosting and `file://`.

## Game Checks
- Blackjack: new round flow works, seat count changes resize table correctly, shoe visibility behavior is correct by device class.
- Poker: table renders, round progression works, and seat count changes resize table correctly.
- Klondike: drag/drop works on desktop and touch, mobile panning works while a card is selected, and variant/draw settings apply correctly.
- FreeCell: drag/drop works on desktop and touch, and mobile panning works while a card is selected.
- Spider: drag/drop works on desktop and touch, mobile panning works while a card is selected, and suit-mode options behave correctly.
- Pyramid: Draw 1/Draw 3 both work, and pyramid+waste layout is usable in portrait and landscape.
- Table Top: new deal and target controls work, and pile/foundation/deck configuration is applied correctly.

## Persistence Checks (Solitaire)
- State is restored after reload.
- State is saved after moves.
- Save is cleared after a win.

## Update Policy
- If substantial behavior changed, ask: "Would you like me to add this to `QA_SMOKE.md`?"
- If substantial behavior changed, ask: "Would you like me to update the related docs now (`AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`)?"
