#!/usr/bin/env bash
# Full on-device end-to-end test of the example app (used by CI).
#
#   e2e/device-e2e.sh android   # needs a running emulator + adb (x86_64 or arm64-v8a)
#   e2e/device-e2e.sh ios       # needs macOS, Xcode, CocoaPods and a booted simulator
#
# Requires maestro (https://maestro.mobile.dev) on PATH.
set -euo pipefail

PLATFORM="${1:?usage: device-e2e.sh <android|ios>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="$ROOT/examples/AirdropExample"
WORK="$(mktemp -d)"
PORT=8787
SERVER="http://127.0.0.1:$PORT"
ADMIN_TOKEN="e2e-admin-token"
CLI="node $ROOT/packages/cli/dist/index.js"
export XDG_CONFIG_HOME="$WORK/config"
# Files the test edits; restored on exit (git checkout is not enough for untracked files).
BACKUP="$WORK/backup"; mkdir -p "$BACKUP"
cp "$EXAMPLE/src/release.ts" "$BACKUP/src__release.ts"
cp "$EXAMPLE/ios/AirdropExample/Info.plist" "$BACKUP/ios__AirdropExample__Info.plist"
cp "$EXAMPLE/android/app/src/main/res/values/strings.xml" "$BACKUP/android__app__src__main__res__values__strings.xml"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFAIL: %s\033[0m\n' "$*"; exit 1; }
# Kills a process and all its descendants (no setsid on macOS; workerd must not outlive the run).
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" 2>/dev/null || true; }
cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill_tree "$SERVER_PID"
  cp "$BACKUP/src__release.ts" "$EXAMPLE/src/release.ts" 2>/dev/null || true
  cp "$BACKUP/ios__AirdropExample__Info.plist" "$EXAMPLE/ios/AirdropExample/Info.plist" 2>/dev/null || true
  cp "$BACKUP/android__app__src__main__res__values__strings.xml" "$EXAMPLE/android/app/src/main/res/values/strings.xml" 2>/dev/null || true
  rm -f "$EXAMPLE/airdrop.config.json"
}
trap cleanup EXIT
grep -q "RELEASE_LABEL = 'embedded'" "$EXAMPLE/src/release.ts" || fail "examples/AirdropExample/src/release.ts must export RELEASE_LABEL = 'embedded'"

if [[ "$PLATFORM" == android ]]; then APP_ID=com.airdropexample; else APP_ID=org.reactjs.native.example.AirdropExample; fi

log "Building SDK + CLI"
(cd "$ROOT" && pnpm --filter react-native-airdrop build >/dev/null && pnpm --filter react-native-airdrop-cli build >/dev/null)

log "Starting server"
curl -sf "$SERVER/health" >/dev/null 2>&1 && fail "port $PORT is already in use"
cd "$ROOT/apps/server"
rm -rf .wrangler/state
printf 'ADMIN_TOKEN=%s\n' "$ADMIN_TOKEN" > .dev.vars
npx wrangler d1 migrations apply airdrop --local >/dev/null
npx wrangler dev --port "$PORT" --ip 127.0.0.1 --var CHECK_CACHE_TTL:0 > "$WORK/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 90); do curl -sf "$SERVER/health" >/dev/null && break; sleep 1; done
curl -sf "$SERVER/health" >/dev/null || { cat "$WORK/server.log"; fail "server did not start"; }

log "Creating app (signed updates)"
cd "$EXAMPLE"
rm -f airdrop.config.json
$CLI login --server "$SERVER" --token "$ADMIN_TOKEN"
$CLI init --name "Device E2E" --sign --key-out "$WORK/private.pem" > "$WORK/init.log"
AIRDROP_APP_ID=$(node -p "require('./airdrop.config.json').appId")
PUBLIC_KEY=$(grep -o 'airdrop_public_key">[^<]*' "$WORK/init.log" | cut -d'>' -f2)
node scripts/configure-airdrop.js --app-id "$AIRDROP_APP_ID" --server "http://localhost:$PORT" \
  --android-server "http://10.0.2.2:$PORT" --public-key "$PUBLIC_KEY"

log "Building and installing the release app ($PLATFORM)"
if [[ "$PLATFORM" == android ]]; then
  # Build only the emulator's ABI (x86_64 on Intel/Linux hosts, arm64-v8a on Apple Silicon).
  ABI=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures="${ABI:-x86_64}" --no-daemon -q)
  adb install -r android/app/build/outputs/apk/release/app-release.apk
else
  (cd ios && pod install >/dev/null)
  xcodebuild -workspace ios/AirdropExample.xcworkspace -scheme AirdropExample -configuration Release \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build \
    CODE_SIGNING_ALLOWED=NO -quiet
  xcrun simctl install "${SIM_UDID:-booted}" ios/build/Build/Products/Release-iphonesimulator/AirdropExample.app
fi

release() { # <label>
  if [[ "$1" == crash ]]; then
    printf "throw new Error('boom');\nexport const RELEASE_LABEL = 'crash';\n" > src/release.ts
  else
    printf "export const RELEASE_LABEL = '%s';\n" "$1" > src/release.ts
  fi
  # (No `tee /dev/stderr`: it is unavailable when stderr is a socket, as in the emulator runner.)
  local out
  out=$($CLI release --platform "$PLATFORM" --private-key "$WORK/private.pem" --message "$1" 2>&1) || { echo "$out" >&2; return 1; }
  echo "$out" | tail -1 >&2
  echo "$out" | tail -1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
}
flow() { maestro ${SIM_UDID:+--device "$SIM_UDID"} test --env APP_ID="$APP_ID" "$@"; }

log "1. Embedded bundle on first launch"
flow "$ROOT/e2e/maestro/embedded.yaml"

log "2. OTA update is downloaded and applied after restart"
V2=$(release ota-v2)
flow --env LABEL=ota-v2 "$ROOT/e2e/maestro/apply-update.yaml"

log "3. Crashing update is rolled back automatically"
CRASH=$(release crash)
flow --env LABEL=ota-v2 "$ROOT/e2e/maestro/crash-rollback.yaml"

log "4. Server-side rollback returns to the embedded bundle"
$CLI rollback "$CRASH" >/dev/null
$CLI rollback "$V2" >/dev/null
flow "$ROOT/e2e/maestro/rollback-embedded.yaml"

log "Server-side stats"
$CLI updates list

printf '\n\033[1;32mDevice E2E passed on %s.\033[0m\n' "$PLATFORM"
