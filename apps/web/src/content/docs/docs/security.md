---
title: "Security"
description: "Threat model, code signing and recommendations."
---

## Threat model

| threat | mitigation |
|---|---|
| Tampering in transit / CDN / storage | every file verified against its SHA-256 before it is used |
| Compromised server or leaked admin token pushing malicious JS | **code signing**: with `AirdropPublicKey` / `airdrop_public_key` in the binary, devices reject updates not signed by your private key, which never touches the server |
| Path traversal via a crafted manifest | paths are validated on the server *and* on the device (no `..`, absolute paths or backslashes; canonical path check on Android) |
| Bad update bricking the app | automatic rollback when an update crashes before `notifyAppReady()`; failed updates are never retried; server-side rollback |
| JS running against incompatible native code | runtime version targeting; store installs discard old OTA updates |
| Token theft from the database | API tokens stored as SHA-256 hashes, compared in constant time |

Not covered (documented trade-offs):

- **Downgrade to an older signed update**: an attacker controlling the server could serve an
  older update you signed for the same runtime version. Rotate keys or bump the runtime version
  if you need to revoke a signed update.
- `/v1/check` and `/v1/assets` are public by design (like CodePush deployment keys): anyone who
  knows an app id can download its bundles. Don't put secrets in your JS bundle (you shouldn't
  anyway; the bundle inside your store binary is equally extractable).

## Recommendations

1. Always use `--sign` in production and keep the private key in a secrets manager / CI secret.
2. Use a dedicated API token per CI pipeline (`airdrop tokens create ci`) and revoke it on rotation.
3. Use HTTPS (default on Cloudflare). Plain HTTP is only for local development.
4. Release to a `staging` channel or a small rollout first, watch `airdrop updates list`
   for rollbacks, then promote / widen.
5. Consider [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
   on `/v1/check` and `/v1/events`.

## App store policies

Updating JavaScript and assets is permitted by Apple and Google as long as you don't change the
app's primary purpose or add features that would not pass review. See
[How it works › Native changes](/docs/how-it-works/#native-changes).
