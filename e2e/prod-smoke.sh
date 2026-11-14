#!/usr/bin/env bash
# Smoke test against a deployed server (used by .github/workflows/prod-smoke.yml):
#   CLI init (signed) -> release a real Android bundle -> POST /v1/check -> download every file
#   twice (cold + edge cache) and verify its SHA-256.
#
#   AIRDROP_SERVER=https://airdrop-api.example.com AIRDROP_TOKEN=<admin token> bash e2e/prod-smoke.sh
#
# Creates a temporary "Prod smoke <timestamp>" app on the server and deletes it on exit.
set -euo pipefail

: "${AIRDROP_SERVER:?set AIRDROP_SERVER}"
: "${AIRDROP_TOKEN:?set AIRDROP_TOKEN}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="$ROOT/examples/AirdropExample"
WORK="$(mktemp -d)"
CLI="node $ROOT/packages/cli/dist/index.js"
export XDG_CONFIG_HOME="$WORK/config"
BACKUP="$WORK/backup"; mkdir -p "$BACKUP"
cp "$EXAMPLE/src/release.ts" "$BACKUP/release.ts"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFAIL: %s\033[0m\n' "$*"; exit 1; }
cleanup() {
  cp "$BACKUP/release.ts" "$EXAMPLE/src/release.ts" 2>/dev/null || true
  rm -f "$EXAMPLE/airdrop.config.json"
  # Don't leave a test app behind on the server (it also removes its files and metering rows).
  [[ -n "${APP_ID:-}" ]] && curl -sf -X DELETE "$AIRDROP_SERVER/v1/apps/$APP_ID" -H "authorization: Bearer $AIRDROP_TOKEN" >/dev/null || true
}
trap cleanup EXIT
grep -q "RELEASE_LABEL = 'embedded'" "$EXAMPLE/src/release.ts" || fail "examples/AirdropExample/src/release.ts must export RELEASE_LABEL = 'embedded'"
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

log "Server $AIRDROP_SERVER"
curl -sf "$AIRDROP_SERVER/health" | grep -q '"ok":true' || fail "health check failed"

log "Building CLI"
(cd "$ROOT" && pnpm --filter react-native-airdrop-cli build >/dev/null)

log "CLI: login + init (signed)"
cd "$EXAMPLE"
rm -f airdrop.config.json
$CLI login --server "$AIRDROP_SERVER" --token "$AIRDROP_TOKEN"
$CLI init --name "Prod smoke $(date -u +%Y%m%dT%H%M%SZ)" --sign --key-out "$WORK/private.pem" > "$WORK/init.log"
APP_ID=$(node -p "require('./airdrop.config.json').appId")
echo "appId=$APP_ID"

log "Release (android, real Hermes bundle)"
printf "export const RELEASE_LABEL = 'prod-smoke';\n" > src/release.ts
OUT=$($CLI release --platform android --private-key "$WORK/private.pem" --message prod-smoke --runtime-version smoke 2>&1) || { echo "$OUT"; fail "release failed"; }
echo "$OUT" | tail -1
UPDATE_ID=$(echo "$OUT" | tail -1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

log "POST /v1/check"
curl -sf "$AIRDROP_SERVER/v1/check" -H 'content-type: application/json' \
  -d "{\"appId\":\"$APP_ID\",\"platform\":\"android\",\"runtimeVersion\":\"smoke\",\"deviceId\":\"prod-smoke-device\",\"currentUpdateId\":null}" \
  > "$WORK/check.json"
[[ $(node -p "require('$WORK/check.json').status") == update ]] || { cat "$WORK/check.json"; fail "expected status=update"; }
[[ $(node -p "require('$WORK/check.json').update.id") == "$UPDATE_ID" ]] || fail "check returned a different update"
[[ $(node -p "Boolean(require('$WORK/check.json').update.signature)") == true ]] || fail "update is not signed"

log "Download and verify every file"
node -e '
  const u = require(process.argv[1]).update;
  for (const f of [u.launchAsset, ...u.assets]) console.log(f.hash, f.url);
' "$WORK/check.json" > "$WORK/files.txt"
N=0
while read -r HASH URL; do
  for attempt in cold cached; do # the second request is served from the edge cache
    curl -sf --compressed -o "$WORK/file" "$URL" || fail "download failed ($attempt): $URL"
    [[ $(sha256 "$WORK/file") == "$HASH" ]] || fail "hash mismatch ($attempt): $URL"
  done
  N=$((N + 1))
done < "$WORK/files.txt"
LAUNCH_URL=$(head -1 "$WORK/files.txt" | cut -d' ' -f2)
curl -sf --compressed -o "$WORK/launch" "$LAUNCH_URL"
grep -aq prod-smoke "$WORK/launch" || fail "launch bundle does not contain the release label"
echo "verified $N file(s)"

log "Already up to date once installed"
curl -sf "$AIRDROP_SERVER/v1/check" -H 'content-type: application/json' \
  -d "{\"appId\":\"$APP_ID\",\"platform\":\"android\",\"runtimeVersion\":\"smoke\",\"deviceId\":\"prod-smoke-device\",\"currentUpdateId\":\"$UPDATE_ID\"}" \
  > "$WORK/check2.json"
[[ $(node -p "require('$WORK/check2.json').status") == noUpdate ]] || { cat "$WORK/check2.json"; fail "expected noUpdate"; }

printf '\n\033[1;32mProduction smoke test passed (%s, app %s, update %s).\033[0m\n' "$AIRDROP_SERVER" "$APP_ID" "$UPDATE_ID"
