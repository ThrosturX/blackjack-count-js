#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Using JAVA_HOME=$JAVA_HOME"

if [[ ! -d android ]]; then
  echo "ERROR: android/ not found. Run: npm run cap:add:android"
  exit 1
fi

npm install
npx cap sync android
(cd android && ./gradlew clean assembleDebug)
bash scripts/android_install_connected.sh

echo "Done: full rebuild and deploy complete."

