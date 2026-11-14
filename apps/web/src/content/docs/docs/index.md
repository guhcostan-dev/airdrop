---
title: "Introduction"
description: "Over-the-air updates for React Native, delivered from Cloudflare's edge."
---

Over-the-air (OTA) updates for React Native apps: ship JavaScript and asset
fixes to production **without waiting for App Store / Play Store review**. Add the open-source
SDK, release from the CLI, and Airdrop delivers the update from Cloudflare's global edge.

It is a spiritual successor to Microsoft CodePush, which was retired together with
App Center on March 31, 2025.

## Highlights

- **Works with bare React Native** 0.71 → 0.87+, old and new architecture, Hermes and JSC.
  No Expo required (works in Expo prebuild projects too).
- **Hosted on Cloudflare's edge**: update checks and downloads are served close to your users,
  with no servers for you to run. Plans start free; see [pricing](/#pricing).
- **Fast downloads**: files are content-addressed and gzip-compressed; devices only
  download files that changed (an update that only touches JS downloads just the bundle).
- **Safe by default**
  - automatic rollback: if a new update crashes before the app renders, the next launch
    goes back to the previous bundle and that update is never installed again;
  - every file is verified with SHA-256; optional end-to-end **code signing** (ECDSA P-256)
    with the public key baked into the binary, so not even Airdrop's servers can push code to your users;
  - updates are bound to a **runtime version**, so JS never runs against native code it
    wasn't built for; installing a new store build discards older OTA updates.
- **Release controls**: channels (staging/production), staged rollouts (1–100%),
  mandatory updates, instant server-side rollback, promote between channels, install/rollback stats.

## What about native code?

Only JavaScript and assets can be updated over the air. Apple (Developer Program
License Agreement / App Review Guideline 2.5.2) and Google Play (Device and Network
Abuse policy) forbid downloading executable native code, and iOS code signing
makes it technically impossible anyway. Instead, react-native-airdrop makes native
changes **safe**: an update only reaches binaries with the same runtime version.
See [How it works](/docs/how-it-works/#native-changes).

## Next steps

- [Getting started](/docs/getting-started/): from zero to your first OTA update in ~15 minutes.
- [React Native SDK reference](/docs/react-native-sdk/)
