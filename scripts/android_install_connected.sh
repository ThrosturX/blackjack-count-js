#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found on PATH."
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "ERROR: APK not found at $APK_PATH"
  echo "Run: npm run android:build:debug"
  exit 1
fi

CONNECTED_DEVICE="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [[ -z "$CONNECTED_DEVICE" ]]; then
  echo "ERROR: no authorized adb device found."
  echo "Check USB cable, USB debugging, and device authorization."
  exit 1
fi

echo "Installing on device: $CONNECTED_DEVICE"
adb install -r "$APK_PATH"
