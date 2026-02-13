# QA Smoke Checklist

## When To Run
- Before release.
- After major UI/layout changes.
- After touch/drag logic changes.
- After shared system refactors.
- After gameplay rule or persistence behavior changes.
- For rendering-only changes (CSS/layout/markup) that do not affect gameplay, persistence, shared systems, or input handling, run targeted visual checks instead of the full smoke checklist.
- Not required for isolated add-on visual/effect polish that does not change gameplay or interaction behavior.

## Global Checks
- Every page loads with no console errors.
- Header menus collapse/expand correctly.
- Back button, title, and menu toggles do not overlap.
- Table/deck theme selectors apply immediately and remain applied after gameplay interactions.
- No unnecessary horizontal scrolling when content fits.
- Horizontal scrolling works when content does not fit.
- Works from both static hosting and `file://`.
- Store page loads and Back button returns to previous page when history exists.
- Add-ons list only shows claimed add-ons (with `Default Themes` available by default).

## Game Checks
- Blackjack: new round flow works, seat count changes resize table correctly, shoe visibility hides only when fit/overlap requires it, dealer content shifts slightly when shoe encroaches near center, and sit/seat controls stay reachable at large table scales.
- Poker: table renders, round progression works, and seat count changes resize table correctly.
- Klondike: drag/drop works on desktop and touch, mobile panning works while a card is selected, and variant/draw settings apply correctly.
- FreeCell: drag/drop works on desktop and touch, and mobile panning works while a card is selected.
- Spider: drag/drop works on desktop and touch, mobile panning works while a card is selected, and suit-mode options behave correctly.
- Pyramid: Draw 1/Draw 3 both work, and pyramid+waste layout is usable in portrait and landscape.
- Golf Solitaire: The new launcher entry loads cleanly, stock/waste/foundation interactions work, and score/time/high-score UI updates match the expected flow.
- Rush Hour Patience: help text opens with the full rules, rush-hour/backseat flow behaves correctly, stand limits apply (1/2), and Joker settings (off/on, count, pass mode) affect stock-pass behavior as expected.
- Baker's Dozen Solitaire: The layout loads without console errors, moves/undo/hint/auto-complete behave correctly, and the foundation/tableau rules plus win overlay reset work on desktop and mobile.
- Table Top Sandbox: new deal and target controls work, and pile/foundation/deck configuration is applied correctly.
- Solitaire high score displays update correctly and remain scoped to the currently selected ruleset (variant/draw/suit mode).

## Persistence Checks (Solitaire)
- State is restored after reload.
- State is saved after moves.
- Save is cleared after a win.

## Entitlement Checks
- Claiming an add-on in Store makes it available in supported games after reload.
- Unclaimed add-ons remain hidden from Add-ons panels.
- `Reset purchases` returns to default claim set (`default-themes` only).

## Update Policy
- Ask to update this file only when behavior-impacting work changes what should be tested.
- For isolated add-on/theme/effect visual work, skip the default prompt to update `QA_SMOKE.md`.
- For rendering-only work with no gameplay/input/state impact, avoid requiring unrelated logic test suites by default.
- Ask to update related docs when substantial behavior, architecture, or shared-system contracts changed.
