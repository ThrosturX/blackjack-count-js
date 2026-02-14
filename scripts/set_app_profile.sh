#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${1:-}"

case "$PROFILE" in
  suite)
    DISPLAY_NAME="Card Playing Suite"
    TAGLINE="Casino and solitaire in one shared app shell."
    LAUNCHER_GROUPS='"casino", "solitaire", "sandbox"'
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
    LAUNCHER_GROUPS='"solitaire", "sandbox"'
    STORE_GAME_FILTER='"klondike", "freecell", "spider", "pyramid", "tabletop"'
    STORE_ENABLED="true"
    ;;
  *)
    echo "Usage: bash scripts/set_app_profile.sh <suite|casino|solitaire>"
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
    storeEnabled: $STORE_ENABLED
  });

  global.AppProfile = profile;
})(window);
EOF

echo "Profile applied: $PROFILE"
echo "Updated: src/app-profile.js"
