<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://airdrop.guhcostan.dev/brand/logo-wordmark-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://airdrop.guhcostan.dev/brand/logo-wordmark-light.png" />
  <img alt="Airdrop" src="https://airdrop.guhcostan.dev/brand/logo-wordmark-dark.png" width="360" />
</picture>

</div>

# Airdrop for React Native (`react-native-airdrop`)

Over-the-Air (OTA) JavaScript and asset updates for React Native (`0.71` through `0.87+`), with client-side ECDSA P-256 signing, content-addressed asset deduplication, and native 2-launch crash rollback.

- Site: [airdrop.guhcostan.dev](https://airdrop.guhcostan.dev)
- Console: [airdrop.guhcostan.dev/dashboard](https://airdrop.guhcostan.dev/dashboard/)
- Docs: [airdrop.guhcostan.dev/docs/getting-started](https://airdrop.guhcostan.dev/docs/getting-started/)

```sh
airdrop release --platform ios --message "Fix checkout button" --rollout 20 --private-key ./airdrop-private-key.pem
```

## Architecture

<div align="center">
  <img src="https://airdrop.guhcostan.dev/brand/architecture.png" alt="Airdrop architecture" width="100%" />
</div>

## Packages

| Package | Registry | Description |
| :--- | :--- | :--- |
| [`packages/react-native`](packages/react-native) | [`react-native-airdrop`](https://www.npmjs.com/package/react-native-airdrop) | Native manager for iOS (Objective-C++) and Android (Java) + TypeScript API & Expo plugin |
| [`packages/cli`](packages/cli) | [`react-native-airdrop-cli`](https://www.npmjs.com/package/react-native-airdrop-cli) | `airdrop` CLI — Metro/Hermes bundler, ECDSA P-256 signer, delta uploader, release commands |
| [`packages/core`](packages/core) | `@rn-airdrop/core` | Protocol types, validation, deterministic rollout bucketing, canonical signing envelope |

## Quick Start

```sh
npm install react-native-airdrop
cd ios && pod install
```

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

```tsx
import { withAirdrop } from "react-native-airdrop";

export default withAirdrop(App);
```

See [Getting Started](https://airdrop.guhcostan.dev/docs/getting-started/) for Expo plugin setup, key generation, and self-hosting.

## License

MIT
