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
    echo "Usage: bash scripts/android_build_debug.sh <suite|casino|solitaire>"
    exit 1
    ;;
esac

GRADLE_TASK="assemble${FLAVOR^}Debug"

if [[ ! -d android ]]; then
  echo "ERROR: android/ not found. Run: npm run cap:add:android"
  exit 1
fi

echo "Using JAVA_HOME=$JAVA_HOME"
(cd android && ./gradlew "$GRADLE_TASK")

APK_PATH="android/app/build/outputs/apk/$FLAVOR/debug/app-$FLAVOR-debug.apk"
if [[ -f "$APK_PATH" ]]; then
  echo "APK: $APK_PATH"
else
  echo "WARNING: build finished but APK not found at expected path: $APK_PATH"
fi
