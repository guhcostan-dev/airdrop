# Testing (internal)

| layer | command | what it covers |
|---|---|---|
| core protocol | `pnpm --filter @rn-airdrop/core test` | signing message, path validation, rollout bucketing |
| server | `pnpm --filter @rn-airdrop/server test` | full API in the Workers runtime (Miniflare, D1, R2): auth, uploads with hash verification, targeting, rollout, rollback, mandatory propagation, signatures, promote |
| CLI | `pnpm --filter react-native-airdrop-cli test` | key generation/signing, runtime-version detection, file collection |
| JS SDK | `pnpm --filter react-native-airdrop test` | sync flow, install modes, failed-update filtering, telemetry |
| Android native core | JUnit (`packages/react-native/android/src/test`) | download, gzip, hash and signature verification, reuse of unchanged files, crash rollback, binary upgrade reset, path traversal |
| local E2E | `bash e2e/local-e2e.sh` | real Worker + real CLI (`react-native bundle` + `hermesc` + signing) + the real Android update manager on the JVM |
| production smoke | `AIRDROP_SERVER=… AIRDROP_TOKEN=… bash e2e/prod-smoke.sh` (or the *Production smoke test* workflow) | against a deployed server: signed release → `/v1/check` → every file downloaded twice (cold + cached) and hash-verified |
| device E2E | `bash e2e/device-e2e.sh android\|ios` | release build of `examples/AirdropExample` on an emulator/simulator driven by Maestro: embedded → OTA update → crashing update rolled back → server rollback to embedded |

CI (`.github/workflows/ci.yml`) runs all of them; the device E2E runs on an Android
emulator (arm64-v8a) and on an iOS simulator. `device-e2e.sh` builds the release APK for
the emulator's ABI only, so it also works on x86_64 hosts.

## Self-hosted CI runner

All workflows (`ci.yml`, `deploy-server.yml`, `deploy-web.yml`, `release.yml`, `prod-smoke.yml`) run on a
self-hosted macOS Apple Silicon runner (`runs-on: [self-hosted, macOS, ARM64]`).
Node, pnpm, JDK 17 and the Android SDK are installed by the workflows themselves
(`actions/setup-node`, `pnpm/action-setup`, `actions/setup-java`, `android-actions/setup-android`);
Maestro is installed into `~/.maestro` on first use. The runner machine must provide:

- **Xcode** (with an iOS simulator runtime and at least one iPhone simulator) and the command-line tools:
  `xcode-select --install`, then open Xcode once to accept the license.
- **CocoaPods**: `brew install cocoapods`.
- **Python 3**, `curl`, `git` (preinstalled on macOS).
- Optional: an existing Android SDK in `ANDROID_HOME` (Android Studio) to skip the download;
  the emulator uses Apple's Hypervisor framework, no extra setup.
- Free disk: ~15 GB (emulator image, Gradle and CocoaPods caches, Xcode derived data).
- Port 8787 free while the E2E jobs run (they start a local `wrangler dev`).

Pull requests from forks are skipped on purpose: a self-hosted runner would run untrusted
code. Also keep *Settings → Actions → General → Require approval for all outside
collaborators* enabled in the organization.
