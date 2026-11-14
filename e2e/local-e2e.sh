#!/usr/bin/env bash
# End-to-end test that runs anywhere (no emulator needed):
#   real Worker (wrangler dev + local D1/R2) -> real CLI (react-native bundle + hermesc + signing)
#   -> real Android UpdateManager (JVM) doing check/download/verify/launch/rollback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="$ROOT/examples/AirdropExample"
WORK="$(mktemp -d)"
PORT="${PORT:-8787}"
SERVER="http://127.0.0.1:$PORT"
ADMIN_TOKEN="e2e-admin-token"
CLI="node $ROOT/packages/cli/dist/index.js"
export XDG_CONFIG_HOME="$WORK/config"
# Files the test edits; restored on exit (git checkout is not enough for untracked files).
BACKUP="$WORK/backup"; mkdir -p "$BACKUP"
cp "$EXAMPLE/src/release.ts" "$BACKUP/src__release.ts"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFAIL: %s\033[0m\n' "$*"; exit 1; }

# Kills a process and all its descendants (no setsid on macOS; workerd must not outlive the run).
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" 2>/dev/null || true; }
cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill_tree "$SERVER_PID"
  cp "$BACKUP/src__release.ts" "$EXAMPLE/src/release.ts" 2>/dev/null || true
  rm -f "$EXAMPLE/airdrop.config.json"
}
trap cleanup EXIT
grep -q "RELEASE_LABEL = 'embedded'" "$EXAMPLE/src/release.ts" || fail "examples/AirdropExample/src/release.ts must export RELEASE_LABEL = 'embedded'"

log "Building CLI"
(cd "$ROOT" && pnpm --filter react-native-airdrop-cli build >/dev/null)

log "Starting server on $SERVER"
curl -sf "$SERVER/health" >/dev/null 2>&1 && fail "port $PORT is already in use"
cd "$ROOT/apps/server"
rm -rf .wrangler/state
printf 'ADMIN_TOKEN=%s\n' "$ADMIN_TOKEN" > .dev.vars
npx wrangler d1 migrations apply airdrop --local >/dev/null
npx wrangler dev --port "$PORT" --ip 127.0.0.1 --var CHECK_CACHE_TTL:0 > "$WORK/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do curl -sf "$SERVER/health" >/dev/null && break; sleep 1; done
curl -sf "$SERVER/health" >/dev/null || { cat "$WORK/server.log"; fail "server did not start"; }

log "CLI: login + init (with signing)"
cd "$EXAMPLE"
rm -f airdrop.config.json
$CLI login --server "$SERVER" --token "$ADMIN_TOKEN"
$CLI init --name "E2E Example" --sign --key-out "$WORK/private.pem" | tee "$WORK/init.log"
APP_ID=$(node -p "require('./airdrop.config.json').appId")
PUBLIC_KEY=$(grep -o 'airdrop_public_key">[^<]*' "$WORK/init.log" | cut -d'>' -f2)
[[ ${#PUBLIC_KEY} -eq 88 ]] || fail "no public key"

log "Compiling Android UpdateManager + device simulator"
mkdir -p "$WORK/classes"
javac -nowarn -d "$WORK/classes" "$ROOT/packages/react-native/android/src/main/java/com/rnairdrop/UpdateManager.java" "$ROOT/e2e/jvm/DeviceSim.java" 2>&1 | grep -v JAVA_TOOL_OPTIONS || true
DEVICE="$WORK/device"
device() { java -cp "$WORK/classes" DeviceSim "$DEVICE" "1.0(1)" "$PUBLIC_KEY" "$@" 2>&1 | grep -v JAVA_TOOL_OPTIONS; }
DEVICE_ID=$(device launch-ready | grep deviceId= | cut -d= -f2)

check() { # -> writes $WORK/check.json
  local current="${1:-null}"
  [[ "$current" != "null" ]] && current="\"$current\""
  curl -sf "$SERVER/v1/check" -H 'content-type: application/json' \
    -d "{\"appId\":\"$APP_ID\",\"platform\":\"android\",\"runtimeVersion\":\"1.0\",\"deviceId\":\"$DEVICE_ID\",\"currentUpdateId\":$current}" \
    > "$WORK/check.json"
  node -p "require('$WORK/check.json').status"
}
manifest_txt() {
  node -e '
    const u = require(process.argv[1]).update;
    const lines = [u.id, u.runtimeVersion, u.platform, u.signature || "-"];
    for (const f of [u.launchAsset, ...u.assets]) lines.push([f.path, f.hash, f.size, f.url].join(" "));
    require("fs").writeFileSync(process.argv[2], lines.join("\n") + "\n");
    console.log(u.id);
  ' "$WORK/check.json" "$WORK/manifest.txt"
}
release() { # label
  printf "export const RELEASE_LABEL = '%s';\n" "$1" > "$EXAMPLE/src/release.ts"
  [[ "$1" == crash ]] && printf "throw new Error('boom');\nexport const RELEASE_LABEL = 'crash';\n" > "$EXAMPLE/src/release.ts"
  $CLI release --platform android --private-key "$WORK/private.pem" --message "$1" | tail -1
}
# Launch the app once (`launch` = dies before notifyAppReady, `launch-ready` = healthy).
# Prints the release label of the bundle that booted; full output in $WORK/launch.out.
start_app() {
  device "$1" > "$WORK/launch.out"
  local path; path=$(grep launched= "$WORK/launch.out" | cut -d= -f2)
  [[ "$path" == embedded ]] && { echo embedded; return; }
  grep -aoE 'ota-v[0-9]+|boom' "$path" | head -1 | sed 's/boom/crash/'
}

log "1. Fresh install runs the embedded bundle"
[[ $(check) == noUpdate ]] || fail "expected noUpdate"
[[ $(start_app launch-ready) == embedded ]] || fail "expected embedded"

log "2. Publish ota-v2 (real RN bundle + Hermes + signature) and install it"
release ota-v2
[[ $(check) == update ]] || fail "expected update"
V2=$(manifest_txt)
device download "$WORK/manifest.txt"
[[ $(start_app launch-ready) == ota-v2 ]] || fail "expected ota-v2 after restart"
grep -q "installed=$V2" "$WORK/launch.out" || fail "install not confirmed"
[[ $(check "$V2") == noUpdate ]] || fail "expected noUpdate after install"

log "3. Tampered manifest is rejected by signature verification"
release ota-v3 >/dev/null
check "$V2" >/dev/null
manifest_txt >/dev/null
sed -i.bak '2s/.*/9.9/' "$WORK/manifest.txt"   # change runtimeVersion => signature no longer matches
OUT=$(device download "$WORK/manifest.txt" || true)
echo "$OUT"
grep -q "error=ERR_SIGNATURE" <<<"$OUT" || fail "tampered update accepted"
V3=$(manifest_txt)
device download "$WORK/manifest.txt" | grep -q downloaded= || fail "v3 download failed"
[[ $(start_app launch-ready) == ota-v3 ]] || fail "expected ota-v3"

log "4. A crashing update is rolled back automatically"
release crash
check "$V3" >/dev/null
CRASH=$(manifest_txt)
device download "$WORK/manifest.txt" >/dev/null
[[ $(start_app launch) == crash ]] || fail "expected crash bundle to be launched once"
# ...the app died before notifyAppReady(); next launch:
[[ $(start_app launch-ready) == ota-v3 ]] || fail "expected rollback to ota-v3"
grep -q "rollbacks=$CRASH" "$WORK/launch.out" || fail "rollback not reported"
grep -q "failed=$CRASH" "$WORK/launch.out" || fail "crash update not blacklisted"
check "$V3" >/dev/null; manifest_txt >/dev/null
OUT=$(device download "$WORK/manifest.txt" || true)
grep -q ERR_UPDATE_FAILED_BEFORE <<<"$OUT" || fail "crash update was re-downloaded"

log "5. Disabling updates on the server sends devices back to the embedded bundle"
$CLI rollback "$CRASH" >/dev/null
$CLI rollback "$V3" >/dev/null
$CLI rollback "$V2" >/dev/null
[[ $(check "$V3") == rollbackToEmbedded ]] || fail "expected rollbackToEmbedded"

log "6. Staged rollout + promote"
$CLI resume "$V2" >/dev/null
$CLI rollout "$V2" 50 >/dev/null
$CLI promote "$V2" --to staging >/dev/null
$CLI updates list | head -8

log "7. Customer flow: an app-scoped token links its app and can't reach other apps"
CUSTOMER_TOKEN=$($CLI tokens create "Customer" --app "$APP_ID" | grep -oE 'ad_[A-Za-z0-9_-]+')
OTHER_APP=$(curl -sf "$SERVER/v1/apps" -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Someone else"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
CUSTOMER="$WORK/customer"; mkdir -p "$CUSTOMER"; cp "$EXAMPLE/package.json" "$CUSTOMER/"
(
  export XDG_CONFIG_HOME="$WORK/customer-config"
  cd "$CUSTOMER"
  $CLI login --server "$SERVER" --token "$CUSTOMER_TOKEN" >/dev/null
  $CLI init | grep -q "Linked app" || fail "init did not link the customer's app"
  [[ $(node -p "require('./airdrop.config.json').appId") == "$APP_ID" ]] || fail "linked the wrong app"
  [[ $($CLI apps list | grep -c "$OTHER_APP") == 0 ]] || fail "customer can see another app"
  $CLI updates list | grep -q "$V2" || fail "customer can't list their updates"
  $CLI usage | grep -q "Monthly active devices" || fail "customer can't see usage"
  ! $CLI updates list --app "$OTHER_APP" >/dev/null 2>&1 || fail "customer can read another app's updates"
  ! $CLI tokens create sneaky >/dev/null 2>&1 || fail "customer can create tokens"
)

printf '\n\033[1;32mAll local E2E checks passed.\033[0m\n'
