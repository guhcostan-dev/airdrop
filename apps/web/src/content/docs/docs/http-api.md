---
title: "HTTP API"
description: "Device and admin endpoints."
---

All bodies are JSON. The base URL is `https://airdrop-api.guhcostan.dev`. Management routes require
`Authorization: Bearer <app token>`; an app token only reaches its own app (other app ids return 404).

## Device routes (public)

### `POST /v1/check`

```json
{ "appId": "uuid", "platform": "ios", "runtimeVersion": "1.0.0", "channel": "production",
  "deviceId": "random-per-install", "currentUpdateId": "uuid|null", "sdkVersion": "0.1.0" }
```

Responses: `{ "status": "noUpdate" }`, `{ "status": "rollbackToEmbedded" }` or

```json
{ "status": "update", "update": {
  "id": "uuid", "createdAt": "...", "channel": "production", "platform": "ios",
  "runtimeVersion": "1.0.0", "message": "Fix checkout", "mandatory": false,
  "launchAsset": { "path": "main.jsbundle", "hash": "<sha256>", "size": 123, "url": "https://.../v1/assets/<app>/<sha256>" },
  "assets": [ { "path": "assets/src/img/logo.png", "hash": "...", "size": 1, "url": "..." } ],
  "signature": "base64 DER ECDSA-P256-SHA256 | null" } }
```

### `GET /v1/assets/:appId/:sha256`

Immutable, `Content-Encoding: gzip`, cached at the edge for a year.

### `POST /v1/events`

```json
{ "appId": "uuid", "deviceId": "...", "events": [ { "type": "install|rollback|download|error", "updateId": "uuid" } ] }
```

## Admin routes

| method & path | body | |
|---|---|---|
| `GET /v1/apps` | | the app(s) your token can access |
| `GET/PATCH /v1/apps/:appId` | `{ name?, signingPublicKey? }` | |
| `DELETE /v1/apps/:appId` | | deletes the app, its updates, files and tokens |
| `GET /v1/apps/:appId/usage` | | `{ month, plan, activeDevices, activeDevicesLimit, storageBytes, storageBytesLimit, overLimit }` |
| `POST /v1/apps/:appId/assets/missing` | `{ hashes: [] }` | → `{ missing: [] }` |
| `PUT /v1/apps/:appId/assets/:sha256` | gzip bytes | server verifies the hash after decompression; `413` over the plan's storage |
| `POST /v1/apps/:appId/updates` | `PublishUpdateRequest` | all files must be uploaded first; `402` when over the plan's monthly active devices |
| `GET /v1/apps/:appId/updates?channel&platform&runtimeVersion&limit` | | includes `stats` |
| `GET /v1/apps/:appId/updates/:id` | | |
| `PATCH /v1/apps/:appId/updates/:id` | `{ enabled?, rolloutPercentage?, mandatory? }` | |
| `POST /v1/apps/:appId/updates/:id/promote` | `{ channel, rolloutPercentage?, mandatory?, message? }` | |

## Signing message

```
airdrop-v1
<runtimeVersion>
<platform>
<launchAsset.path>:<launchAsset.hash>
<asset.path>:<asset.hash>        (one line per asset, sorted by path)
```

joined with `\n`, signed with ECDSA P-256 / SHA-256, DER-encoded, base64.
The public key is the base64 of the 65-byte uncompressed point (`04 || X || Y`).
