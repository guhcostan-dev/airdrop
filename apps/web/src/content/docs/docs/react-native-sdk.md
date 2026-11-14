---
title: "React Native SDK"
description: "Native setup and JavaScript API reference."
---

```sh
npm install react-native-airdrop && cd ios && pod install
```

Supports React Native **0.71+** (built in CI on 0.71, 0.73, 0.76, 0.80, 0.84 and 0.87), old and new architecture,
bare or Expo (config plugin, see [Getting started](/docs/getting-started/))
(classic native module, works through the new-arch interop layer), Hermes and JSC,
iOS 12.4+, Android 5.0+ (API 21).

## Native configuration

| | iOS (`Info.plist`) | Android (`res/values/strings.xml`) |
|---|---|---|
| Server URL (required) | `AirdropServerURL` | `airdrop_server_url` |
| App id (required) | `AirdropAppId` | `airdrop_app_id` |
| Public key (enables signature enforcement) | `AirdropPublicKey` | `airdrop_public_key` |
| Runtime version (default: app version) | `AirdropRuntimeVersion` | `airdrop_runtime_version` |
| Channel (default `production`) | `AirdropChannel` | `airdrop_channel` |
| Enable in debug builds (default off) | `AirdropEnableInDebug` = `true` | `airdrop_enable_in_debug` = `true` |

Server URL, app id and channel can also be set from JS with `configure()`. The public key
can only be set natively, so a malicious update cannot replace it.

Native entry points: see [Getting started](/docs/getting-started/#4-install-the-sdk).

## JavaScript API

```ts
import Airdrop, { withAirdrop, useAirdrop } from "react-native-airdrop";
```

### `withAirdrop(Component, options?)`

Wraps the root component. Calls `notifyAppReady()` after mount and `sync(options)`.

```ts
export default withAirdrop(App, {
  checkFrequency: "onAppResume",       // "onAppStart" (default) | "onAppResume" | "manual"
  installMode: "nextResume",           // "nextRestart" (default) | "nextResume" | "immediate"
  mandatoryInstallMode: "immediate",   // default
  minimumBackgroundDuration: 60,       // seconds, for nextResume
});
```

### `sync(options?) => Promise<SyncResult>`

Checks, downloads and schedules the install. Concurrent calls share a single run.
Resolves `{ status }` where status is one of
`upToDate | installed | rolledBackToEmbedded | disabled | error`.
`onStatusChange` additionally reports `checking` and `downloading`.

### `checkForUpdate()`, `downloadUpdate(update)`, `restartApp()`

Lower-level building blocks if you want your own UI (e.g. "Update available — restart?"):

```ts
const result = await Airdrop.checkForUpdate();
if (result.status === "update") {
  await Airdrop.downloadUpdate(result.update);
  Alert.alert("Update ready", result.update.message ?? "", [
    { text: "Later" },
    { text: "Restart", onPress: Airdrop.restartApp },
  ]);
}
```

### `notifyAppReady()`

Confirms that the running bundle works. **If you don't use `withAirdrop` or `sync`, you must
call it** once the app has rendered, otherwise the update is rolled back on the next launch.

### `getState()` / `useAirdrop()`

```ts
const { state, status, sync, refresh } = useAirdrop();
// state: { enabled, platform, runtimeVersion, channel, deviceId,
//          currentUpdateId, pendingUpdateId, failedUpdateIds, ... }
```

### `configure({ serverUrl?, appId?, channel?, timeout? })`

Override native configuration at runtime, e.g. to let internal testers switch to a `staging` channel.

### `clearUpdates()`

Return to the embedded bundle on the next launch.

## Debug builds

In debug builds the app loads JS from Metro and the SDK is disabled (`sync` resolves
`disabled`). Set `AirdropEnableInDebug` / `airdrop_enable_in_debug` to test the native flow
in a debuggable build without Metro.

## Error codes

| code | meaning |
|---|---|
| `ERR_SIGNATURE` | missing or invalid signature while a public key is configured |
| `ERR_HASH_MISMATCH` | a downloaded file does not match its SHA-256 |
| `ERR_INVALID_MANIFEST` | malformed manifest, unsafe path or wrong launch file name |
| `ERR_UPDATE_FAILED_BEFORE` | this update already crashed on this device |
| `ERR_DOWNLOAD` / `ERR_IO` | network or storage failure (safe to retry) |
