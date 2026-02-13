#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building solitaire-only Android debug APK..."
npm run profile:solitaire
npm run cap:sync
bash scripts/android_build_debug.sh solitaire

echo "Done: solitaire-only debug build complete."
