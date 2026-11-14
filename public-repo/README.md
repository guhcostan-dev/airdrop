<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://airdrop.guhcostan.dev/brand/logo-wordmark-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://airdrop.guhcostan.dev/brand/logo-wordmark-light.png" />
  <img alt="Airdrop" src="https://airdrop.guhcostan.dev/brand/logo-wordmark-dark.png" width="360" />
</picture>

<br />

# Airdrop for React Native (`react-native-airdrop`)

**Zero-Trust Over-the-Air (OTA) Updates for React Native — SDK & CLI**

[![npm](https://img.shields.io/npm/v/react-native-airdrop?style=for-the-badge&label=react-native-airdrop&color=22d3ee)](https://www.npmjs.com/package/react-native-airdrop)
[![npm](https://img.shields.io/npm/v/react-native-airdrop-cli?style=for-the-badge&label=react-native-airdrop-cli&color=10b981)](https://www.npmjs.com/package/react-native-airdrop-cli)
[![CI](https://img.shields.io/github/actions/workflow/status/guhcostan-dev/airdrop/ci.yml?style=for-the-badge&label=CI)](https://github.com/guhcostan-dev/airdrop/actions/workflows/ci.yml)

[**Website & Playground**](https://airdrop.guhcostan.dev) · [**Release Console**](https://airdrop.guhcostan.dev/dashboard/) · [**Getting Started**](https://airdrop.guhcostan.dev/docs/getting-started/) · [**Security Model**](https://airdrop.guhcostan.dev/docs/security/)

<br />

<img src="https://airdrop.guhcostan.dev/brand/hero-orbital-drop.png" alt="Airdrop Orbital OTA Architecture" width="100%" />

</div>

---

```sh
airdrop release --platform ios --message "Fix checkout button" --rollout 20 --private-key ./airdrop-private-key.pem
```

## Packages in This Repository

| Package | npm | Description |
| :--- | :--- | :--- |
| [`packages/react-native`](packages/react-native) | [`react-native-airdrop`](https://www.npmjs.com/package/react-native-airdrop) | Native update manager for iOS (Objective-C++) and Android (Java) + TypeScript API & Expo Config Plugin |
| [`packages/cli`](packages/cli) | [`react-native-airdrop-cli`](https://www.npmjs.com/package/react-native-airdrop-cli) | `airdrop` CLI — Metro/Hermes bundler, ECDSA P-256 signer, content-addressed uploader, and release manager |
| [`packages/core`](packages/core) | `@rn-airdrop/core` | Wire protocol types, validation, deterministic rollout bucketing, and canonical signing envelope |

## Architecture

<div align="center">
  <img src="https://airdrop.guhcostan.dev/brand/architecture.png" alt="Airdrop Architecture" width="100%" />
</div>

## Why Airdrop?

- **End-to-End ECDSA P-256 Code Signing:** Your private key never leaves your machine or CI. Native iOS (`SecKeyVerifySignature`) and Android (`java.security.Signature`) verify the signature against the public key baked into your binary before booting any OTA bundle.
- **2-Launch Crash Watchdog & Automatic Rollback:** Updates that crash before `Airdrop.notifyAppReady()` are automatically rolled back on the next launch and blacklisted on the device.
- **Content-Addressed Deduplication:** Every file is stored and verified by its SHA-256 digest. Devices only download files that changed since the previous release.
- **Staged Canary Rollouts (1–100%):** Deterministic bucketing (`SHA-256(deviceId:updateId) mod 100`), channel promotion (`staging → production`), and instant server-side rollback.
- **Works with Bare React Native & Expo:** React Native 0.71 → 0.87+, Old and New Architecture, Hermes and JSC, iOS and Android.

## Quick Start

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

Add `AirdropServerURL` / `AirdropAppId` to `Info.plist` and `airdrop_server_url` / `airdrop_app_id` to `strings.xml` (`airdrop init` prints the exact values, or use the `"react-native-airdrop/expo"` config plugin).

**3. Wrap your root component**

```tsx
import { withAirdrop } from "react-native-airdrop";

export default withAirdrop(App); // checks on launch, applies on next restart
```

**4. Release**

```sh
npm install -g react-native-airdrop-cli
airdrop login --server https://airdrop-api.guhcostan.dev --token <your-app-token>
airdrop init --sign
airdrop release --platform android --private-key airdrop-private-key.pem
```

Full guide: **[Getting started](https://airdrop.guhcostan.dev/docs/getting-started/)**.

## License

[MIT](LICENSE)
