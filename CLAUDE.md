# CLAUDE.md

Guidance for AI agents (and humans) working in this repository.

## What this is

react-native-airdrop: self-hosted over-the-air (OTA) updates for React Native on Cloudflare.
pnpm monorepo (Node ≥ 20, pnpm 10). The example app is a separate npm project.

| path | what | stack |
|---|---|---|
| `packages/core` | wire protocol types, request validation, canonical signing message, rollout bucketing | TS, no deps |
| `apps/server` | update server | Cloudflare Worker, Hono, D1 (SQL), R2 |
| `packages/cli` | `airdrop` CLI (`react-native-airdrop-cli` on npm) | Node, tsup bundle (core is inlined) |
| `packages/react-native` | SDK (`react-native-airdrop` on npm) | TS + Objective-C (`ios/`) + Java (`android/`) |
| `apps/web` | landing page (`src/pages/index.astro`) + docs (`src/content/docs/docs/*.md`) | Astro + Starlight; landing: Tailwind v4 + Basecoat UI, Lucide icons (`@lucide/astro`); Geist via Fontsource (landing + docs) |
| `examples/AirdropExample` | RN 0.87 app wired to the SDK; npm (not pnpm), links the SDK via `file:` | React Native |
| `e2e` | `local-e2e.sh` (no device), `device-e2e.sh` + Maestro flows, `prod-smoke.sh` | bash |
| `public-repo` | README, CI, workspace files for the public SDK/CLI repo | |
| `brand` | logo (SVG/PNG), wordmarks, OG card | |

## Commands

```sh
pnpm install
pnpm test                                   # all unit tests (server tests run in workerd via @cloudflare/vitest-plugin)
pnpm typecheck
pnpm --filter <pkg> test                    # e.g. @rn-airdrop/server, react-native-airdrop-cli, react-native-airdrop
pnpm dev:server                             # wrangler dev on :8787; needs apps/server/.dev.vars: ADMIN_TOKEN=...
pnpm web:dev | pnpm web:build
bash e2e/local-e2e.sh                       # needs: examples/AirdropExample `npm ci`, JDK
bash e2e/device-e2e.sh android|ios          # needs emulator/simulator + maestro
```

Android native unit tests are plain JUnit (no Gradle needed):

```sh
cd packages/react-native/android
javac -d /tmp/c -cp junit.jar src/main/java/com/rnairdrop/UpdateManager.java src/test/java/com/rnairdrop/UpdateManagerTest.java
java -cp /tmp/c:junit.jar:hamcrest.jar org.junit.runner.JUnitCore com.rnairdrop.UpdateManagerTest
```

## Architecture invariants (do not break)

- **Signing message** is defined once in `packages/core/src/signing.ts` and mirrored in
  `UpdateManager.signingMessage` (Java) and `+[RNAirdropUpdateManager signingMessage:]` (ObjC).
  Change all three together and keep the cross-language test in `UpdateManagerTest` passing.
  The update id is deliberately *not* signed (so `promote` works without re-signing).
- **Files are content-addressed** by SHA-256 of the *uncompressed* bytes; R2 stores gzip
  (`apps/<appId>/assets/<hash>`) and the server verifies the hash on upload. Devices verify again.
- **Runtime version** must be computed identically by the CLI (`packages/cli/src/project.ts`) and
  the native SDK (`AirdropRuntimeVersion` / `airdrop_runtime_version`, else app version).
- **Launch protocol** (Java `UpdateManager` ⇄ ObjC `RNAirdropUpdateManager`, keep them in sync):
  `pending` → first launch sets `pendingLaunched` → JS `notifyAppReady()` promotes to `current`;
  a launch that finds `pendingLaunched` already set rolls back and blacklists the update.
  `resolveBundlePath` must be idempotent within a process, except when a new update was staged
  (iOS in-process reload for `immediate` installs).
- A new binary (version/build/install time) wipes OTA state. Native code never trusts JS for the
  public key: it comes from Info.plist / strings.xml only.
- The native module is a classic module (`RCT_EXPORT_MODULE` / `ReactPackage`) on purpose: it works
  on RN 0.71+ and through the new-architecture interop layer. Android restarts use a separate process
  (`AirdropRestartActivity`) because the ReactHost bundle loader is fixed at creation.
- Server hot path: `POST /v1/check` does one cached D1 read (`loadCandidates`, `CHECK_CACHE_TTL`).
  Keep it that way; don't add per-request writes there (events go to `/v1/events` via `waitUntil`).
  The only write it triggers is monthly-active-device metering (`usage.ts`): deduped per isolate,
  batched, `INSERT OR IGNORE`, after the response via `waitUntil` (~1 write per device per month).
- Multi-tenant: customer API tokens are scoped to one app (`api_tokens.app_id`); `requireAppAccess`
  returns 404 for other apps. Plan limits live in `apps/server/src/plans.ts` and must match the prices
  in `apps/web/src/utils/pricing.ts`. Over the MAU limit only *publishing* is blocked (402), never devices.

## Conventions

- TypeScript strict, ESM, 2-space indent, double quotes in packages (the example app keeps RN template style).
- Validate all external input (see `packages/core/src/validation.ts`); paths inside updates must pass
  `isSafeRelativePath` on the server and the equivalent checks on device.
- Docs live in `apps/web/src/content/docs/docs/`, in English (the platform is English-only for now).
  Update them with any user-facing change.
- Don't commit build output (`dist/`, `lib/`, `android/build/`), `.dev.vars`, private keys or
  `examples/AirdropExample/airdrop.config.json`.
- `examples/AirdropExample/src/release.ts` must stay `RELEASE_LABEL = 'embedded'`; the E2E scripts
  rewrite it temporarily and refuse to run otherwise.

## Deploy & release

- Cloudflare account id is pinned in `apps/*/wrangler.jsonc`. D1 database `airdrop`, R2 bucket `airdrop-assets`.
- Production: server `https://airdrop-api.guhcostan.dev`, site `https://airdrop.guhcostan.dev`
  (custom domains attached to the `airdrop-server` / `airdrop-web` workers).
- GitHub: this monorepo is **private** (`guhcostan-dev/react-native-airdrop`). The npm packages are mirrored to the
  **public** repo `guhcostan-dev/airdrop` by `sync-public.yml` (`scripts/export-public.sh`: `packages/{core,cli,react-native}`,
  `tsconfig.base.json`, `LICENSE` and the files in `public-repo/`; secret `PUBLIC_REPO_TOKEN`). Never put server, web,
  infra or deploy details in those paths. Public PRs are applied here by hand, then synced back.
- All workflows here run on a self-hosted macOS ARM64 runner
  (`runs-on: [self-hosted, macOS, ARM64]`; fork PRs are skipped). Prerequisites in `docs/testing.md`.
- GitHub Actions: `ci.yml` (unit + local E2E on every push; device E2E on `main`/manual),
  `deploy-server.yml`, `deploy-web.yml`, `release.yml` (npm). Secrets: `CLOUDFLARE_API_TOKEN`,
  `AIRDROP_ADMIN_TOKEN`, `NPM_TOKEN`.
- Bump versions in `packages/react-native/package.json`, `packages/cli/package.json` and the
  `SDK_VERSION` constants (Java `Airdrop.SDK_VERSION`, ObjC `sdkVersion`, CLI `VERSION`) together.
