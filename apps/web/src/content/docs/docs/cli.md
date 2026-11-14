---
title: "CLI"
description: "Bundle, sign, publish and manage releases."
---

```sh
npm install -g react-native-airdrop-cli
airdrop help
```

Connection settings resolve in this order: flags (`--server`, `--token`) → environment
(`AIRDROP_SERVER`, `AIRDROP_TOKEN`, `AIRDROP_APP_ID`, `AIRDROP_PRIVATE_KEY_PATH`) →
`airdrop.config.json` (project) → `~/.config/airdrop/credentials.json` (written by `login`).
The server defaults to the hosted API, `https://airdrop-api.guhcostan.dev`.

## Setup

| command | |
|---|---|
| `airdrop login --token <token>` | validate and store your app token |
| `airdrop init [--app <id>] [--sign] [--key-out <file>]` | link your app, write `airdrop.config.json`, optionally generate a signing key |
| `airdrop keys generate [--out <file>]` | create a key pair later and register the public key (from then on unsigned updates are rejected) |
| `airdrop apps list` | show the app your token can access |
| `airdrop usage` | monthly active devices and storage against your plan |

## Releasing

```sh
airdrop release --platform <ios|android> [options]
```

| option | default | |
|---|---|---|
| `--channel, -c` | `production` | target channel |
| `--message, -m` | | release notes, available to the app |
| `--mandatory` | off | install immediately (`mandatoryInstallMode`) |
| `--rollout <1-100>` | 100 | staged rollout percentage |
| `--runtime-version <v>` | detected | otherwise read from Info.plist / project.pbxproj / strings.xml / build.gradle exactly like the SDK does |
| `--private-key <pem>` | | sign the update (required when the app has a public key) |
| `--entry-file <file>` | `index.js` | |
| `--no-hermes` | auto | Hermes is detected from `gradle.properties` / `Podfile`; `hermesc` from `react-native` or `hermes-compiler` |
| `--bundle-dir <dir> --bundle-name <file>` | | publish an already-built output (e.g. from Expo `export:embed`) |
| `--dry-run` | | bundle only |

## Managing updates

| command | |
|---|---|
| `airdrop updates list [--channel] [--platform] [--limit]` | history with install and rollback counts |
| `airdrop rollout <updateId> <percent>` | change rollout |
| `airdrop rollback <updateId>` | disable; devices on it move to the previous update or the embedded bundle |
| `airdrop resume <updateId>` | re-enable |
| `airdrop promote <updateId> --to <channel> [--rollout]` | copy to another channel (files are shared, the signature stays valid) |

## CI example (GitHub Actions)

```yaml
- run: npm ci
- run: echo "$AIRDROP_PRIVATE_KEY" > /tmp/airdrop.pem
  env: { AIRDROP_PRIVATE_KEY: "${{ secrets.AIRDROP_PRIVATE_KEY }}" }
- run: npx react-native-airdrop-cli release -p android -m "${{ github.event.head_commit.message }}" --private-key /tmp/airdrop.pem
  env:
    AIRDROP_TOKEN: ${{ secrets.AIRDROP_TOKEN }}   # your app token
```
