# AGENTS.md

## Project Identity
- Repository: `bj_table` (subject to be renamed appropriately).
- Product: Card Playing Suite (working name), browser-first with shared systems and shared UX patterns.

## Games
- Blackjack
- Texas Hold'em Poker
- Klondike Solitaire
- FreeCell
- Spider Solitaire
- Pyramid Solitaire
- Golf Solitaire
- Baker's Dozen Solitaire
- Table Top Sandbox
- And potentially other card games.

## Product Direction
- User experience is the top priority for every implementation decision.
- Keep desktop and mobile browser support first-class.
- Keep architecture ready for mobile app deployment, with Android as first target.
- Plan for monetization via non-intrusive ads, a paid "Remove Ads" entitlement, and optional paid add-ons/skin packs in a mini-store.
- Prefer changes that avoid future rewrites for ads, entitlements, store catalog, and content packs.

## Runtime Constraints
- Must run from `file://` and static hosting with no server assumptions.
- Do not introduce CORS-dependent patterns for core loading paths.
- Prefer plain JS/HTML/CSS and progressive enhancement.
- Keep performance acceptable on mid-range mobile devices.
- Preserve save-state compatibility where practical.
- Runtime web assets must live under `src/` only (`src/styles`, `src/addons`, `src/*.js`, `src/*.html`).
- Do not reintroduce mirrored root `styles/` or root `addons/` directories; root `index.html` is only a redirect entrypoint.

## Shared Systems Map
- `src/common.js`: shared card/deck utilities, card sizing metrics, scroll/min-height helpers, high-score storage helpers, and `StateManager`.
- `src/header.js`: shared header controls, toggle/collapse behavior, and default open sections.
- `src/shared/mobile-controller.js`: touch drag/pan coordination and mobile-safe pointer behavior.
- `src/shared/ui-helpers.js`: shared hit-testing and pointer helper utilities.
- `src/shared/solitaire-insolvability.js`: shared rapid static insolvability detector with reusable forbidden-subgraph matchers for solitaire variants.
- `src/shared/solitaire-solvability.js`: shared forward-only solvability search engine for checking whether a current solitaire state can still be solved.
- `src/shared/solitaire-check-modal.js`: shared modal UI helper for solitaire check/progress/result prompts and confirm flows.
- `src/shared/solitaire-ui-feedback.js`: shared modal/toast feedback wrapper for help, hint, and outcome messaging with safe fallback behavior.
- `src/shared/solitaire-check-worker.js`: worker-backed solitaire check runner used by both FreeCell and Klondike check flows.
- `src/shared/entitlements.js`: shared local entitlement storage with claim ownership/source metadata and future authoritative sync hooks.
- `src/shared/entitlement-sync.js`: lifecycle-aware authoritative entitlement sync bridge (native bridge first, debug mock fallback).
- `src/addons/manifest.js` and `src/addons.js`: add-on catalog and registration.
- `src/app-profile.js`: build-selected app profile (`suite`, `casino`, `solitaire`) used by launcher/store filtering and split packaging workflows.
- `src/styles/core.css`, `src/styles/layout.css`, `src/styles/mobile.css`: shared style layers (base, layout, mobile overrides loaded last).
- If new shared systems are introduced during a turn, update this section in the same turn, or explicitly propose the update at the end of the turn.

## UX and UI Rules
- UX quality is not optional; optimize for clarity, responsiveness, and low friction.
- Core gameplay actions must stay reachable on both mobile orientations.
- Prefer shared responsive rules and shared components over per-game one-off hacks.
- Prevent overlap between header navigation, title, and control toggles at all supported widths.
- Enable horizontal scrolling only when content truly overflows.
- Use subtle visual feedback; avoid immersion-breaking effects.
- For substantial UI changes, state expected behavior on desktop and mobile in the turn summary.

## QA Smoke Checklist
- Open each game page and verify there are no console errors on load.
- Verify starting a new deal/hand/game works.
- Verify drag/drop and tap controls on desktop and mobile.
- Verify mobile panning still works while cards are picked up where scrolling is needed.
- Verify no unnecessary horizontal scrolling when layout fits viewport.
- Verify save/load behavior for solitaire games and clear saved state on win.
- Verify header menu collapse/expand behavior and default open state.
- Verify operation from `file://` with no CORS/module-loading failures.
- Run the full checklist when gameplay, shared systems, persistence, input handling, or cross-game layout behavior changes.
- For isolated add-on/theme/effect visual polish that does not change gameplay or interaction behavior, full smoke testing is optional and `QA_SMOKE.md` updates are not required by default.
- For isolated rendering-only adjustments (CSS/layout/markup) that do not change gameplay rules, persistence, shared systems, or input handling, targeted visual validation is sufficient and full logic test runs are optional.
- Ask to update `QA_SMOKE.md` only when the checklist itself should change due to behavior-impacting work.
- Ask to update related project docs/files when those docs are made stale by non-trivial behavior or architecture changes.

## Solitaire Refinement Checklist
- Treat `src/klondike.js` as the interaction baseline; isolate rule differences to game logic, not input/render architecture.
- On restore, ensure cards remain runtime card objects (use shared hydration/revival helpers and avoid flattening card instances into plain objects).
- Preserve horizontal scroll positions when rebuilding tableau/foundation DOM and when running adaptive sizing.
- Avoid forced `window.scrollTo` viewport writes as a first fix for layout jumps; stabilize sizing/anchoring and container scroll instead.
- Provide desktop convenience parity where applicable (e.g., double-click auto-move to foundation for eligible top cards).
- Required targeted regression pass after solitaire interaction or persistence changes:
- `new game -> make moves -> refresh -> continue playing` must preserve valid moves.
- Verify desktop drag/click and mobile tap-pick/tap-drop both work after restore.
- Verify horizontal pan/scroll position does not jump after legal moves.

## Documentation Files
- `AGENTS.md`: operating constraints, shared systems map, UX rules, and turn hygiene.
- `README.md`: product overview, game/variant inventory, and runtime expectations.
- `ARCHITECTURE.md`: shared-system boundaries and technical contracts.
- `QA_SMOKE.md`: smoke verification coverage across games.
- `ROADMAP.md`: sequencing for stabilization, mobile app readiness, and monetization.
- `mobile/android/README.md`: Android wrapper setup/resume instructions and command workflow.

## Turn Hygiene
- Reuse shared systems first and keep implementations DRY.
- After substantial changes, call out which shared systems were touched.
- If documentation is now stale, propose the exact file updates before ending the turn.
- Keep developer workflow scripts in `scripts/` when adding recurring multi-step commands.
- During rapid prototyping or minor web-only changes, avoid unnecessary Android sync/build/deploy steps by default.
- Run `cap:sync` / Android build steps when native files changed, Android-specific behavior must be validated, or an APK/installable artifact is explicitly needed.
