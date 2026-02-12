#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export PATH="$JAVA_HOME/bin:$PATH"

if [[ ! -d android ]]; then
  echo "ERROR: android/ not found. Run: npm run cap:add:android"
  exit 1
fi

echo "Using JAVA_HOME=$JAVA_HOME"
(cd android && ./gradlew assembleDebug)

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [[ -f "$APK_PATH" ]]; then
  echo "APK: $APK_PATH"
else
  echo "WARNING: build finished but APK not found at expected path: $APK_PATH"
fi

