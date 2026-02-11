# Roadmap

For Card Playing Suite (working name) in repository `bj_table` (subject to rename).

## Phase 1: Stabilize Shared Foundations
- Keep responsive behavior consistent across all game pages.
- Keep touch drag/pan behavior consistent across solitaire titles.
- Reduce duplicated per-game layout logic by extending shared helpers.
- Keep docs synchronized (`AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `QA_SMOKE.md`).

## Phase 2: Mobile App Readiness (Android First)
- Prepare a WebView wrapper strategy with offline asset packaging.
- Define storage/version migration strategy for saved games.
- Validate input behavior in Android WebView for touch-heavy interactions.
- Add release profile checks for performance on mid-range devices.

## Phase 3: Monetization Foundations
- Add an ad integration boundary (provider-agnostic interface).
- Implement non-intrusive placement policy and frequency caps.
- Add entitlement model for paid "Remove Ads".
- Add catalog model for optional paid addons/skin packs.

## Phase 4: Store and Content Expansion
- Add mini-store UX and purchase restoration flow.
- Split free vs premium addon packs cleanly.
- Add telemetry hooks for conversion and retention analysis.

## Ongoing Engineering Rules
- Favor shared modules over page-specific forks.
- Avoid breaking `file://` runtime behavior.
- Keep UX-first decisions explicit in PR/commit summaries.
