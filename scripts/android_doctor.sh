#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

JAVA_DEFAULT="/usr/lib/jvm/java-21-openjdk"
JAVA_HOME_EFFECTIVE="${JAVA_HOME:-$JAVA_DEFAULT}"
export JAVA_HOME="$JAVA_HOME_EFFECTIVE"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Repository: $ROOT_DIR"
echo "JAVA_HOME: $JAVA_HOME_EFFECTIVE"

if [[ ! -d "$JAVA_HOME_EFFECTIVE" ]]; then
  echo "ERROR: JAVA_HOME path does not exist: $JAVA_HOME_EFFECTIVE"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: java is not on PATH"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is not on PATH"
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "WARNING: adb is not on PATH (USB deploy scripts will fail)"
else
  echo "ADB binary: $(command -v adb)"
fi

SDK_DIR=""
if [[ -f "android/local.properties" ]]; then
  SDK_DIR="$(sed -n 's/^sdk.dir=//p' android/local.properties | head -n 1)"
fi

if [[ -z "$SDK_DIR" ]]; then
  echo "WARNING: android/local.properties missing sdk.dir"
else
  echo "Android SDK: $SDK_DIR"
  if [[ ! -d "$SDK_DIR" ]]; then
    echo "ERROR: sdk.dir path does not exist: $SDK_DIR"
    exit 1
  fi
fi

echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"
echo "Java: $(java -version 2>&1 | head -n 1)"

echo
echo "Capacitor packages:"
npm ls @capacitor/android @capacitor/core @capacitor/cli --depth=0 || true

echo
echo "ADB devices:"
adb devices || true
