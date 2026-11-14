---
title: "Alternatives"
description: "The state of over-the-air updates for React Native in 2026, and where Airdrop fits."
---

## What happened to CodePush

CodePush was a service of **Visual Studio App Center** (Microsoft). In 2024 Microsoft announced the
retirement of all of App Center, which shut down on **March 31, 2025** together with hosted CodePush.
It was a product decision (Microsoft focusing on Azure and GitHub), not a technical problem with
CodePush. Microsoft published a standalone `code-push-server` for self-hosting, but its repositories
were **archived in May 2025** (read-only, unmaintained). The `react-native-code-push` SDK stopped
evolving too and has growing incompatibilities with the New Architecture.

## What's available today

| solution | model | strengths | limitations |
|---|---|---|---|
| **EAS Update** (Expo) | SaaS | the market standard; rollouts, channels, runtime *fingerprint*, Hermes bytecode diffing | billed per MAU; the `expo-updates` SDK pulls in the Expo ecosystem; no official self-hosting |
| **hot-updater** (gronxb) | open source, self-hosted | plugins for Supabase/AWS/Cloudflare; web console | small project, API still changing |
| **Revopush**, **Stallion** | CodePush-style SaaS | easy migration from CodePush | vendor dependency, usage-based pricing |
| **Codemagic Patch** | self-hosted | dashboard + installer | tied to Codemagic |
| `code-push-server` (Microsoft) | self-hosted | compatible with the old SDK | archived; no support |

Every option updates **JavaScript and assets only**.

## Can native code be updated?

Not in a way the stores allow:

- **Apple**: the Developer Program License Agreement (§3.3.1(B)) and guideline 2.5.2 forbid downloading
  executable code; interpreted code (JS) is allowed as long as it doesn't change the app's primary
  purpose. iOS code signing also prevents loading new native binaries.
- **Google Play**: the *Device and Network Abuse* policy forbids downloading executable code (DEX, `.so`)
  from outside Google Play. It would technically work on Android, but the app would be removed.

The right approach, and the one Airdrop takes, is to make native changes **safe**: every update is
bound to a *runtime version*, so older binaries keep receiving compatible JS and new binaries only
receive JS built for them.

## How Airdrop is different

1. **Served from Cloudflare's edge** at a fraction of per-MAU pricing elsewhere ([pricing](/#pricing)), with an open-source SDK.
2. **Per-file diff downloads**: files are addressed by SHA-256; a device downloads only what changed
   and copies the rest from the update it's running.
3. **End-to-end code signing** (ECDSA P-256) with the public key inside the binary: not even Airdrop's
   servers can publish code to your users.
4. **Automatic rollback** on launch crashes, with the update blacklisted on that device and reported.
5. **React Native 0.71+** (old and new architecture), bare or Expo (config plugin).

## Roadmap ideas

- Binary diff of the Hermes bundle (bsdiff) for even smaller updates.
- Web dashboard with adoption and rollback charts.
- Multi-tenant accounts and organizations.
- Automatic `fingerprint` runtime-version policy (a hash of the native dependencies).
- Expo integration (`expo export:embed` already works through `--bundle-dir`).

Sources: [Codemagic: React Native OTA tools in 2026](https://blog.codemagic.io/react-native-ota-tools-in-2026/),
[Bitrise: CodePush alternatives](https://bitrise.io/blog/post/codepush-alternatives),
[Microsoft code-push (archived)](https://github.com/microsoft/code-push),
[Expo: OTA updates](https://expo.dev/articles/updates-and-rollouts/over-the-air-updates),
[Bitrise: what the app stores allow](https://bitrise.io/blog/post/what-app-stores-allow-with-ota-updates-apple-and-google-policy-explained),
[hot-updater](https://github.com/gronxb/hot-updater).
