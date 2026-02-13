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
    echo "Usage: bash scripts/android_full_rebuild_deploy.sh <suite|casino|solitaire>"
    exit 1
    ;;
esac

case "$FLAVOR" in
  suite) PROFILE_SCRIPT="profile:suite" ;;
  casino) PROFILE_SCRIPT="profile:casino" ;;
  solitaire) PROFILE_SCRIPT="profile:solitaire" ;;
esac

GRADLE_TASK="assemble${FLAVOR^}Debug"

echo "Using JAVA_HOME=$JAVA_HOME"

if [[ ! -d android ]]; then
  echo "ERROR: android/ not found. Run: npm run cap:add:android"
  exit 1
fi

npm install
npm run "$PROFILE_SCRIPT"
npx cap sync android
(cd android && ./gradlew clean "$GRADLE_TASK")
bash scripts/android_install_connected.sh "$FLAVOR"

echo "Done: full rebuild and deploy complete for flavor: $FLAVOR."
