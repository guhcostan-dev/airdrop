# Changelog

## 0.3.0

**CLI (`react-native-airdrop-cli`)**

- Self-serve accounts: `airdrop signup`, `airdrop login` with email and password (hidden prompt;
  piped stdin or `AIRDROP_PASSWORD` in scripts), `airdrop logout` and `airdrop whoami`.
  `airdrop login --token` still works for CI tokens.
- `airdrop init` lets you pick one of your apps or create one.
- `airdrop tokens create|list|revoke` manage CI tokens scoped to the project's app.
- `airdrop mcp`: a Model Context Protocol server on stdio (no extra dependencies) with the tools
  `apps`, `updates`, `rollout`, `rollback`, `resume`, `promote` and `usage`.

**SDK (`react-native-airdrop`)**

- No behavior changes; the version moves with the CLI.

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
