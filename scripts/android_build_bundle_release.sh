#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export PATH="$JAVA_HOME/bin:$PATH"
FLAVOR="${1:-suite}"

case "$FLAVOR" in
  suite|casino|solitaire) ;;
  *)
    echo "Usage: bash scripts/android_build_bundle_release.sh <suite|casino|solitaire>"
    exit 1
    ;;
esac

case "$FLAVOR" in
  suite) PROFILE_SCRIPT="profile:suite" ;;
  casino) PROFILE_SCRIPT="profile:casino" ;;
  solitaire) PROFILE_SCRIPT="profile:solitaire" ;;
esac

GRADLE_TASK="bundle${FLAVOR^}Release"
BUNDLE_PATH="android/app/build/outputs/bundle/${FLAVOR}Release/app-${FLAVOR}-release.aab"

if [[ ! -d android ]]; then
  echo "ERROR: android/ not found. Run: npm run cap:add:android"
  exit 1
fi

echo "Using JAVA_HOME=$JAVA_HOME"
npm run "$PROFILE_SCRIPT"
npx cap sync android
(cd android && ./gradlew "$GRADLE_TASK")

if [[ -f "$BUNDLE_PATH" ]]; then
  echo "AAB: $BUNDLE_PATH"
else
  echo "WARNING: build finished but AAB not found at expected path: $BUNDLE_PATH"
fi
