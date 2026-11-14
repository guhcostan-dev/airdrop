<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./brand/logo-wordmark-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="./brand/logo-wordmark-light.png" />
  <img alt="react-native-airdrop" src="./brand/logo-wordmark-dark.png" width="360" />
</picture>

</div>

# react-native-airdrop

Over-the-Air (OTA) JavaScript and asset updates for React Native (`0.71` through `0.87+`, Old and New Architecture, Hermes and JSC, Bare React Native and Expo), self-hosted on **AWS** (`S3` + `CloudFront` + `Lambda`) and **Cloudflare** (`Workers` + `D1` + `R2` + Edge cache).

- Site: [airdrop.guhcostan.dev](https://airdrop.guhcostan.dev)
- Console: [airdrop.guhcostan.dev/dashboard](https://airdrop.guhcostan.dev/dashboard/)
- Docs: [airdrop.guhcostan.dev/docs/getting-started](https://airdrop.guhcostan.dev/docs/getting-started/)
- API health: [airdrop-api.guhcostan.dev/health](https://airdrop-api.guhcostan.dev/health)

```bash
airdrop release --platform ios --channel production --rollout 20 \
  --private-key ./airdrop-private-key.pem \
  --message "Hotfix checkout currency rounding"
```

## Architecture

<div align="center">
  <img src="./brand/architecture.png" alt="react-native-airdrop architecture" width="100%" />
</div>

1. **Client-side ECDSA P-256 signing**: Your private key stays on your laptop or CI runner. The CLI signs a canonical manifest (`airdrop-manifest-v1`) covering `appId`, `channel`, `platform`, `runtimeVersion`, and every file path + SHA-256 digest. Native iOS (`SecKeyVerifySignature`) and Android (`java.security.Signature`) verify the signature against the public key embedded in `Info.plist` / `strings.xml` before booting any update.
2. **2-launch crash watchdog**: Staged updates increment a native boot counter before React Native initializes. If the app crashes or exits before JS calls `Airdrop.notifyAppReady()`, the next launch automatically reverts to the previous bundle (or the embedded store bundle) and blacklists the broken `updateId`.
3. **Content-addressed asset deduplication**: Bundles and assets are indexed by their uncompressed SHA-256 hash. The CLI checks `POST /v1/apps/:appId/assets/missing` and uploads only changed blobs; devices hard-link/copy unchanged files from disk.
4. **Deterministic canary rollouts**: `SHA-256(deviceId + ":" + updateId) mod 100 < rolloutPercentage` enables sticky staged rollouts with zero server session state and instant adjustments via `airdrop rollout <updateId> <pct>`.

## Production Deployment (`guhcostan.dev`)

| Component | Custom Domain (Cloudflare) | AWS Origin (`us-east-2`) | Notes |
| :--- | :--- | :--- | :--- |
| Web & Docs | `https://airdrop.guhcostan.dev` | `https://d21al82u8wh9s4.cloudfront.net` (`s3://airdrop-web-177683310249`) | Astro + Starlight + vanilla scroll choreography (`E386523JW8TUG2` OAC) |
| Release Console | `https://airdrop.guhcostan.dev/dashboard/` | Same S3 / CloudFront distribution | Manage apps, rollout percentages, rollbacks, and interactive demo sandbox |
| OTA API | `https://airdrop-api.guhcostan.dev` | `https://wyyzqc53772b4jdcamirdkh6yu0ydkit.lambda-url.us-east-2.on.aws` | Hono API Worker proxying to AWS Lambda (`nodejs22.x` arm64) + S3 (`airdrop-assets-177683310249`) |

## Workspace Structure

| Path | Package | Responsibility |
| :--- | :--- | :--- |
| [`packages/core`](./packages/core) | `@rn-airdrop/core` | Protocol types, rollout hashing (`isInRollout`), canonical signing payload (`signingMessage`) |
| [`packages/react-native`](./packages/react-native) | `react-native-airdrop` | JS SDK (`withAirdrop`, `useAirdrop`), Expo Config Plugin, iOS (`RNAirdrop.mm`) & Android (`Airdrop.java`) |
| [`packages/cli`](./packages/cli) | `react-native-airdrop-cli` | CLI for login, app init, P-256 keygen, Metro/Hermes bundling, signing, rollout, and rollback |
| [`apps/server`](./apps/server) | `@rn-airdrop/server` | Hono control plane running on AWS Lambda + S3 (`src/aws-lambda.ts`) and Cloudflare Workers (`src/index.ts`) |
| [`apps/web`](./apps/web) | `@rn-airdrop/web` | Landing page, release dashboard (`/dashboard`), and Starlight documentation (`/docs`) |
| [`examples/AirdropExample`](./examples/AirdropExample) | Example App | React Native 0.87 app wired to `react-native-airdrop` for automated smoke & device E2E tests |
| [`e2e`](./e2e) | E2E Suites | `prod-smoke.sh` (Hermes bundle + signed upload + edge download SHA-256 check), `local-e2e.sh`, `device-e2e.sh` |
| [`scripts`](./scripts) | Automation | `deploy-aws.sh` (S3 + CloudFront OAC + Lambda Function URL) and `build-brand.mjs` |

## Getting Started

### 1. Install SDK & CLI

```bash
npm install react-native-airdrop
npm install -g react-native-airdrop-cli
```

### 2. Initialize & Generate Signing Keys

```bash
airdrop login --server https://airdrop-api.guhcostan.dev --token <YOUR_TOKEN>
airdrop init --name "My App" --sign
```

`airdrop init --sign` writes `airdrop.config.json` (containing `serverUrl`, `appId`, and public key) and `airdrop-private-key.pem` (keep out of git; set `AIRDROP_PRIVATE_KEY` in CI).

### 3. Wire Native Entry Points

**Expo (`app.json` / `app.config.ts`)**

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-airdrop/expo",
        {
          "serverUrl": "https://airdrop-api.guhcostan.dev",
          "appId": "00000000-0000-4000-8000-000000000000",
          "channel": "production",
          "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
        }
      ]
    ]
  }
}
```

**Bare React Native (`ios/AppDelegate.swift` & `android/MainApplication.kt`)**

```swift
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
import com.rnairdrop.Airdrop

override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    packageList = PackageList(this).packages,
    jsBundleFilePath = Airdrop.getJSBundleFile(applicationContext),
  )
}
```

### 4. Wrap Root Component

```tsx
import { withAirdrop } from "react-native-airdrop";

export default withAirdrop(App, {
  checkOnMount: true,
  checkOnForeground: true,
  installMode: "ON_NEXT_RESTART",
});
```

### 5. Release & Rollout Commands

```bash
airdrop release --platform ios --channel production --rollout 10 --private-key ./airdrop-private-key.pem
airdrop updates list --channel production
airdrop rollout <updateId> 100
airdrop promote <updateId> --to production
airdrop rollback <updateId>
```

## Self-Hosting & Verification

### Deploy to AWS

```bash
export AWS_REGION=us-east-2
export AIRDROP_ADMIN_TOKEN="<ADMIN_TOKEN>"
bash scripts/deploy-aws.sh
```

### Deploy to Cloudflare

```bash
cd apps/server && npx wrangler deploy
cd ../.. && pnpm web:build
cd apps/web && npx wrangler deploy
```

### Test & Smoke Checks

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm web:build

AIRDROP_SERVER="https://airdrop-api.guhcostan.dev" \
AIRDROP_TOKEN="<ADMIN_TOKEN>" \
bash e2e/prod-smoke.sh
```

## Documentação em Português

O **react-native-airdrop** é uma plataforma open-source (MIT) de atualizações Over-the-Air para React Native, projetada para rodar diretamente na sua conta **AWS** e **Cloudflare**.

- **Landing Page & Documentação**: [airdrop.guhcostan.dev](https://airdrop.guhcostan.dev) (origem CloudFront `https://d21al82u8wh9s4.cloudfront.net`, bucket `s3://airdrop-web-177683310249`)
- **Console de Releases**: [airdrop.guhcostan.dev/dashboard](https://airdrop.guhcostan.dev/dashboard/) (com sandbox interativo)
- **API OTA**: [airdrop-api.guhcostan.dev](https://airdrop-api.guhcostan.dev/health) (proxy Cloudflare Worker -> AWS Lambda `airdrop-api` em `us-east-2` + `s3://airdrop-assets-177683310249`)

```bash
pnpm typecheck && pnpm test
node scripts/build-brand.mjs
bash scripts/deploy-aws.sh
```

## License

MIT
