#!/usr/bin/env bash
# Builds the public repository (guhcostan-dev/airdrop: SDK, CLI, core) from this monorepo.
#
#   bash scripts/export-public.sh <out-dir>
#
# <out-dir> may be a checkout of the public repo: everything except .git is replaced.
# Only packages/{core,cli,react-native}, tsconfig.base.json, LICENSE and public-repo/* are published;
# the server, website, e2e, example app, brand sources and deploy workflows stay private.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: export-public.sh <out-dir>}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
[[ "$OUT" != "$ROOT" && "$OUT" != "$ROOT"/* ]] || { echo "out-dir must be outside the monorepo" >&2; exit 1; }

# Wipe the previous export, keep the public repo's git history.
find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

cd "$ROOT"
# Tracked files only: build output, node_modules and local files never leak.
git ls-files -z -- packages/core packages/cli packages/react-native tsconfig.base.json LICENSE \
  | while IFS= read -r -d '' f; do
      mkdir -p "$OUT/$(dirname "$f")"
      cp -p "$f" "$OUT/$f"
    done
cp -R public-repo/. "$OUT/"

# A lockfile for the public workspace alone (the monorepo's covers private apps too).
(cd "$OUT" && pnpm install --lockfile-only --silent)

echo "exported to $OUT: $(find "$OUT" -type f -not -path "*/.git/*" | wc -l | tr -d " ") files"
