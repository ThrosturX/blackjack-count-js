#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${1:-}"

ADDON_TOGGLE_ALLOWLIST="null"
THEME_DEFAULTS="null"
ADDON_DEFAULTS="null"
AUTO_CLAIM_ALL_ADDONS="false"
AUTO_ENABLE_HIDDEN_ADDONS="false"
TEMP_EDU_IN_SOLITAIRE="false"

case "$PROFILE" in
  suite)
    DISPLAY_NAME="Card Playing Suite"
    TAGLINE="Casino and solitaire in one shared app shell."
    LAUNCHER_GROUPS='"casino", "solitaire", "sandbox", "educational"'
    STORE_GAME_FILTER='"blackjack", "poker", "klondike", "freecell", "spider", "pyramid", "tabletop"'
    STORE_ENABLED="true"
    ;;
  casino)
    DISPLAY_NAME="Card Casino"
    TAGLINE="Focused casino lineup: Blackjack and Texas Hold'em Poker."
    LAUNCHER_GROUPS='"casino"'
    STORE_GAME_FILTER='"blackjack", "poker"'
    STORE_ENABLED="true"
    ;;
  solitaire)
    DISPLAY_NAME="Virtue Solitaire Collection"
    TAGLINE="Select your favourite Patience game, one of our originals or play in the experimental table top sandbox."
    LAUNCHER_GROUPS='"solitaire", "sandbox", "educational"'
    STORE_GAME_FILTER='"klondike", "freecell", "spider", "pyramid", "tabletop"'
    STORE_ENABLED="true"
    TEMP_EDU_IN_SOLITAIRE="true"
    ;;
  premium)
    DISPLAY_NAME="Card Learning & Solitaire Premium"
    TAGLINE="All solitaire content plus kid-friendly educational card games, with no ads and no store."
    LAUNCHER_GROUPS='"solitaire", "sandbox", "educational"'
    STORE_GAME_FILTER='"klondike", "freecell", "spider", "pyramid", "tabletop", "learn-cards", "memory-match", "math-challenges"'
    STORE_ENABLED="false"
    ADDON_TOGGLE_ALLOWLIST='"classic-faces", "worn-cards", "premium-effects"'
    THEME_DEFAULTS='{ table: "ocean", deck: "water" }'
    ADDON_DEFAULTS='{ "classic-faces": true }'
    AUTO_CLAIM_ALL_ADDONS="true"
    AUTO_ENABLE_HIDDEN_ADDONS="true"
    ;;
  *)
    echo "Usage: bash scripts/set_app_profile.sh <suite|casino|solitaire|premium>"
    exit 1
    ;;
esac

cat > src/app-profile.js <<EOF
(function initAppProfile(global) {
  const profile = Object.freeze({
    id: "$PROFILE",
    displayName: "$DISPLAY_NAME",
    tagline: "$TAGLINE",
    launcherGroups: [$LAUNCHER_GROUPS],
    storeGameFilter: [$STORE_GAME_FILTER],
    storeEnabled: $STORE_ENABLED,
    addonToggleAllowlist: $([[ "$ADDON_TOGGLE_ALLOWLIST" == "null" ]] && echo "null" || echo "[$ADDON_TOGGLE_ALLOWLIST]"),
    themeDefaults: $THEME_DEFAULTS,
    addonDefaults: $ADDON_DEFAULTS,
    autoClaimAllAddons: $AUTO_CLAIM_ALL_ADDONS,
    autoEnableHiddenAddons: $AUTO_ENABLE_HIDDEN_ADDONS,
    temporaryEducationalInSolitaire: $TEMP_EDU_IN_SOLITAIRE
  });

  global.AppProfile = profile;
})(window);
EOF

echo "Profile applied: $PROFILE"
echo "Updated: src/app-profile.js"
