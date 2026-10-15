<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://airdrop.guhcostan.dev/brand/logo-wordmark-dark.png" />
  <img alt="Airdrop" src="https://airdrop.guhcostan.dev/brand/logo-wordmark-light.png" width="300" />
</picture>

# Airdrop for React Native

**SDK and CLI for Airdrop over-the-air updates.**

Ship JavaScript and asset fixes to production in minutes, without waiting for App Store / Play Store review.
Airdrop is a hosted service, delivered from Cloudflare's edge: **[request early access](https://airdrop.guhcostan.dev/#access)** to get your app token.

[![npm](https://img.shields.io/npm/v/react-native-airdrop?label=react-native-airdrop)](https://www.npmjs.com/package/react-native-airdrop)
[![npm](https://img.shields.io/npm/v/react-native-airdrop-cli?label=react-native-airdrop-cli)](https://www.npmjs.com/package/react-native-airdrop-cli)
[![CI](https://github.com/guhcostan-dev/airdrop/actions/workflows/ci.yml/badge.svg)](https://github.com/guhcostan-dev/airdrop/actions/workflows/ci.yml)

[Website & docs](https://airdrop.guhcostan.dev) · [Getting started](https://airdrop.guhcostan.dev/docs/getting-started/) · [How it works](https://airdrop.guhcostan.dev/docs/how-it-works/)

</div>

---

```sh
airdrop release --platform ios --message "Fix checkout button" --rollout 20
```

## What's in this repository

| package | npm | what |
|---|---|---|
| [`packages/react-native`](packages/react-native) | [`react-native-airdrop`](https://www.npmjs.com/package/react-native-airdrop) | the SDK: native update manager for iOS (Objective-C) and Android (Java) + JS API |
| [`packages/cli`](packages/cli) | [`react-native-airdrop-cli`](https://www.npmjs.com/package/react-native-airdrop-cli) | the `airdrop` CLI: bundle, sign, upload and manage releases |
| [`packages/core`](packages/core) | (bundled into the CLI) | wire protocol, request validation, signing message, rollout bucketing |

## Why

- **Pricing that scales.** Free up to 10K monthly active users, then flat monthly plans. [Pricing →](https://airdrop.guhcostan.dev/#pricing)
- **Safe by default.**
  - **Automatic crash rollback:** an update that crashes before the app renders is rolled back on the next launch and never installed again.
  - **SHA-256 verification** of every file, plus optional **end-to-end code signing** (ECDSA P-256) with the public key baked into the binary: not even Airdrop's servers can ship code to your users.
  - **Runtime-version targeting:** JS only reaches binaries with compatible native code; a new store build discards old OTA updates.
- **Fast.** Content-addressed files: devices download only what changed, gzip-compressed and edge-cached.
- **Release controls.** Channels, staged rollouts (1-100%), mandatory updates, instant rollback, promote between channels, install/rollback stats.
- **Works with bare React Native** 0.71 → 0.87+, old and new architecture, Hermes and JSC, iOS and Android. No Expo required.

> Native code (Swift/Kotlin, new native modules, permissions) can't be updated over the air on any platform: Apple and Google forbid downloading executable code. Airdrop keeps JS and native in sync with runtime versions instead. [Details →](https://airdrop.guhcostan.dev/docs/how-it-works/#native-changes)

## Quick start

**1. Install the SDK**

```sh
npm install react-native-airdrop
cd ios && pod install
```

**2. Point your app at Airdrop** (release builds only — debug keeps using Metro)

```swift
// iOS · AppDelegate.swift
import ReactNativeAirdrop

override func bundleURL() -> URL? {
#if DEBUG
  RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
  RNAirdrop.bundleURL()
#endif
}
```

```kotlin
// Android · MainApplication.kt
import com.rnairdrop.Airdrop

override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    packageList = PackageList(this).packages,
    jsBundleFilePath = Airdrop.getJSBundleFile(applicationContext),
  )
}
```

Add `AirdropServerURL` / `AirdropAppId` to `Info.plist` and `airdrop_server_url` / `airdrop_app_id` to `strings.xml`
(`airdrop init` prints the exact values).

**3. Wrap your root component**

```tsx
import { withAirdrop } from "react-native-airdrop";

export default withAirdrop(App); // checks on launch, applies on next restart
```

**4. Release**

```sh
npm install -g react-native-airdrop-cli
airdrop login --token <your-app-token>   # from your early-access email
airdrop init --sign                      # links your app, generates a signing key
airdrop release --platform android --private-key airdrop-private-key.pem
```

Full guide, including older React Native versions: **[Getting started](https://airdrop.guhcostan.dev/docs/getting-started/)**.

## Managing releases

```sh
airdrop updates list                         # history with installs & rollbacks
airdrop release -p ios --rollout 10          # staged rollout
airdrop rollout <updateId> 100               # widen it
airdrop rollback <updateId>                  # pull a bad update; devices fall back automatically
airdrop promote <updateId> --to production   # staging → production (signature stays valid)
```

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Android update-manager unit tests run on a plain JVM (no Gradle), see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
