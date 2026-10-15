# Changelog

## 0.2.0

**SDK (`react-native-airdrop`)**

- Expo config plugin: add `["react-native-airdrop", { "appId": "…" }]` to `plugins` in `app.json`
  and run `expo prebuild`. It writes the Info.plist / strings.xml values and points release builds
  at Airdrop (Swift and Objective-C AppDelegate, both MainApplication.kt templates).
- Built in CI against fresh React Native 0.71, 0.73, 0.76, 0.80 and 0.84 apps (iOS and Android)
  and the latest Expo template, plus the 0.87 device end-to-end suite.

**CLI (`react-native-airdrop-cli`)**

- Defaults to the hosted service (`https://airdrop-api.guhcostan.dev`); `airdrop login --token`.
- `airdrop init` links to the app your token belongs to (or `--app <id>`).
- `airdrop usage`: monthly active devices and storage against your plan.
- `airdrop tokens create <name> --app <id>` creates tokens scoped to one app.

## 0.1.0

- First release: signed OTA updates, staged rollouts, automatic rollback, CLI.
