---
title: "Getting started"
description: "From zero to your first OTA update in about 15 minutes."
---

This guide takes a React Native app from zero to receiving its first OTA update.

## 1. Get access

Airdrop is in early access. [Request access](/#access) and we'll create your app and send you an
**app token**. It's scoped to your app: keep it secret and use it on your machine and in CI.

## 2. Install the CLI and log in

```sh
npm install -g react-native-airdrop-cli
airdrop login --token <YOUR-APP-TOKEN>
```

## 3. Link your project

From your React Native project root:

```sh
airdrop init --sign
```

This links your project to your Airdrop app, writes `airdrop.config.json` (safe to commit) and,
with `--sign`, a private key `airdrop-private-key.pem` (**never commit it**; store it as a CI secret).
It prints the native configuration values used below.

## 4. Install the SDK

```sh
npm install react-native-airdrop
cd ios && pod install
```

### iOS

`ios/<App>/Info.plist`:

```xml
<key>AirdropServerURL</key><string>https://airdrop-api.guhcostan.dev</string>
<key>AirdropAppId</key><string>YOUR-APP-ID</string>
<!-- only if you used --sign -->
<key>AirdropPublicKey</key><string>BASE64-PUBLIC-KEY</string>
```

`AppDelegate.swift` (RN ≥ 0.77):

```swift
import ReactNativeAirdrop

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func bundleURL() -> URL? {
  #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
  #else
    RNAirdrop.bundleURL()
  #endif
  }
}
```

Objective-C `AppDelegate.mm` (RN 0.71 – 0.76). Use whichever method your template
already has (`bundleURL`, `getBundleURL` or `sourceURLForBridge:`) and return
`[RNAirdrop bundleURL]` in release builds:

```objc
#import <ReactNativeAirdrop/RNAirdrop.h>

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [RNAirdrop bundleURL];
#endif
}
```

### Android

`android/app/src/main/res/values/strings.xml`:

```xml
<string name="airdrop_server_url" translatable="false">https://airdrop-api.guhcostan.dev</string>
<string name="airdrop_app_id" translatable="false">YOUR-APP-ID</string>
<!-- only if you used --sign -->
<string name="airdrop_public_key" translatable="false">BASE64-PUBLIC-KEY</string>
```

`MainApplication.kt` (RN ≥ 0.80, `getDefaultReactHost`):

```kotlin
import com.rnairdrop.Airdrop

override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    packageList = PackageList(this).packages,
    jsBundleFilePath = Airdrop.getJSBundleFile(applicationContext),
  )
}
```

With a `ReactNativeHost` (RN 0.71 – 0.79, old or new architecture):

```kotlin
override val reactNativeHost: ReactNativeHost =
  object : DefaultReactNativeHost(this) {
    // ...
    override fun getJSBundleFile(): String? = Airdrop.getJSBundleFile(applicationContext)
  }
```

`AirdropPackage` is autolinked.

### Expo (prebuild / development builds)

Using Expo with `npx expo prebuild` (or EAS Build)? Skip the native edits above: add the config plugin to
`app.json` and it writes the `Info.plist` / `strings.xml` values and points release builds at Airdrop.

```json
{
  "expo": {
    "plugins": [
      ["react-native-airdrop", { "appId": "YOUR-APP-ID", "publicKey": "BASE64-PUBLIC-KEY" }]
    ]
  }
}
```

Options: `appId` (required), `publicKey`, `serverUrl` (defaults to the hosted API), `runtimeVersion`, `channel`.
Remove `expo-updates` first: two update systems can't both own the bundle URL. Expo Go can't load native
modules, so use a development build.

### JavaScript

Wrap your root component:

```tsx
import { withAirdrop } from "react-native-airdrop";

function App() { /* ... */ }

export default withAirdrop(App);
```

By default the SDK checks on app start, downloads in the background and applies
the update on the next cold start. See [SDK reference](/docs/react-native-sdk/) for other modes.

## 5. Ship a store build, then an OTA update

OTA updates are disabled in debug builds (they load from Metro). Build a **release**
app and install it, then change some JS and run:

```sh
airdrop release --platform ios --message "Fix checkout button" --private-key airdrop-private-key.pem
airdrop release --platform android --message "Fix checkout button" --private-key airdrop-private-key.pem
```

Open the app (it downloads the update), close it and open it again: the new JS is running.

## 6. Manage releases

```sh
airdrop updates list                 # history, installs and rollbacks
airdrop release -p android --rollout 10    # staged rollout
airdrop rollout <updateId> 100       # widen it
airdrop rollback <updateId>          # pull a bad update; devices fall back automatically
airdrop promote <updateId> --to production
airdrop usage                        # monthly active devices and storage vs your plan
```

Prefer a browser? The [dashboard](/dashboard/) shows the same releases, install and rollback counts and
usage, and lets you change rollouts or roll back with your app token.
