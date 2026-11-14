---
title: "How it works"
description: "Architecture, targeting, launch protocol and automatic rollback."
---

```
 developer                    Cloudflare                              device
 ─────────                    ──────────                              ──────
 airdrop release ──bundle──▶  Worker ──▶ R2 (gzip, content-addressed)
   (react-native bundle,      │
    hermesc, sha256, sign)    └──▶ D1 (apps, updates, stats)
                                                 ▲
                                     POST /v1/check (appId, platform,
                                     runtimeVersion, channel, deviceId,
                                     currentUpdateId) ◀──────────────── JS SDK
                              manifest (files + hashes + signature) ──▶ native SDK
                              GET /v1/assets/<app>/<sha256>  ◀───────── downloads only
                                                                        missing files,
                                                                        verifies, stages
```

## Updates

An update is a set of files produced by `react-native bundle --assets-dest`:
the JS bundle (Hermes bytecode when Hermes is enabled) plus every asset, with their
relative paths preserved. Bundles loaded from a file resolve images relative to the
bundle's directory, so the original layout (`assets/...` on iOS, `drawable-*/...` on Android)
is reproduced on the device.

Each file is identified by its SHA-256. The CLI asks the server which hashes it already
has and uploads only new ones; the device copies unchanged files from the update it is
running and downloads only what changed.

## Targeting

A device receives the newest **enabled** update that matches:

| field | source on the device |
|---|---|
| app | `AirdropAppId` / `airdrop_app_id` |
| platform | `ios` / `android` |
| runtime version | `AirdropRuntimeVersion` / `airdrop_runtime_version`, else the app version (`CFBundleShortVersionString` / `versionName`) |
| channel | `configure({ channel })`, `AirdropChannel` / `airdrop_channel`, else `production` |
| rollout | `hash(deviceId + updateId) % 100 < rolloutPercentage` |

If a device is outside the rollout of the newest update it gets the previous eligible one.
If the update it runs was disabled and nothing else is eligible, the server answers
`rollbackToEmbedded`.

If a device skips over a mandatory update, the update it receives is treated as mandatory too.

## Launch protocol and automatic rollback

The native layer keeps a tiny state file (`current`, `pending`, `pendingLaunched`, `failed`):

1. `downloadUpdate` verifies the signature, downloads files into a staging directory,
   verifies every hash, moves it into place atomically and marks it `pending`.
2. On the next launch, `bundleURL` / `getJSBundleFile` boots `pending` and sets `pendingLaunched`.
3. Once the app renders, the JS SDK calls `notifyAppReady()` and the update becomes `current`.
4. If the process dies before step 3 (crash on startup), the next launch sees
   `pendingLaunched`, marks the update as **failed** (it will never be installed again),
   reports a `rollback` event and boots the previous bundle.

When a new binary is installed from the store (different version, build number or
install time), all downloaded updates are discarded: the embedded bundle is newer.

## Install modes

- `nextRestart` (default): apply on the next cold start. Invisible to users.
- `nextResume`: apply when the app comes back from background.
- `immediate`: restart now. Mandatory updates use this by default.

On iOS a restart is a JS reload (the bridge/host asks `bundleURL` again). On Android the
bundle loader of `ReactHost` is fixed when it is created, so the SDK restarts the process
(same technique as ProcessPhoenix); this works on every RN version and architecture.

## Native changes

OTA can only replace JavaScript and assets. Shipping native code (Swift/ObjC/Kotlin/Java,
new native modules, changes to `Info.plist`, permissions...) requires a store release:

- **Apple** forbids downloading executable code; interpreted JavaScript is allowed only if it
  doesn't change the app's primary purpose (Developer Program License Agreement §3.3.1(B) /
  App Review Guideline 2.5.2). iOS code signing also makes loading new native code impossible.
- **Google Play** forbids apps from downloading executable code (DEX, native libraries) from
  outside Google Play (Device and Network Abuse policy).

What react-native-airdrop does instead is make native changes *safe*:

1. bump the runtime version (or the app version) whenever native code changes;
2. publish OTA updates for each runtime version you still support;
3. old binaries keep receiving compatible JS, new binaries only receive JS built for them.

A good rule: bump `AirdropRuntimeVersion` / `airdrop_runtime_version` when you add or
upgrade a dependency that has native code, or upgrade React Native itself.
