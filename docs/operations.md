# Operations (internal): deploying the Airdrop service on Cloudflare

Everything fits in the Workers free/paid plans: one Worker, one D1 database, one R2 bucket.

## 1. Create the resources

```sh
cd apps/server
npx wrangler login
npx wrangler d1 create airdrop          # copy the database_id into wrangler.jsonc
npx wrangler r2 bucket create airdrop-assets
```

## 2. Configure and deploy

```sh
openssl rand -base64 32 | npx wrangler secret put ADMIN_TOKEN
pnpm run deploy        # applies D1 migrations, then deploys the Worker
```

The Worker is now at `https://airdrop-server.<your-subdomain>.workers.dev`.
Optionally add a custom domain (Workers → Settings → Domains & Routes), e.g. `ota.example.com`,
and set `PUBLIC_URL` if assets should be served from a different hostname.

## 3. Use it

```sh
airdrop login --server https://ota.example.com --token <ADMIN_TOKEN>
airdrop tokens create ci     # for pipelines, instead of the admin token
```

## Deploy from GitHub Actions

Three workflows ship with the repo (all can be run manually from the Actions tab):

| workflow | what it does | secrets |
|---|---|---|
| `deploy-server.yml` | D1 migrations, worker deploy, sets `ADMIN_TOKEN`, smoke test | `CLOUDFLARE_API_TOKEN`, `AIRDROP_ADMIN_TOKEN` |
| `deploy-web.yml` | builds and deploys the landing page + docs | `CLOUDFLARE_API_TOKEN` |
| `release.yml` | publishes `react-native-airdrop` and `react-native-airdrop-cli` to npm | `NPM_TOKEN` |

Set `account_id` in `apps/server/wrangler.jsonc` and `apps/web/wrangler.jsonc` to your account.
The Cloudflare token needs *Workers Scripts: Edit*, *D1: Edit* and *Workers R2 Storage: Edit*
on that account. The npm token must be a granular token with *Bypass two-factor authentication*.

## Configuration

| name | kind | |
|---|---|---|
| `ADMIN_TOKEN` | secret | bootstrap admin token |
| `CHECK_CACHE_TTL` | var | seconds the candidate list is cached per colo (default 10, `0` disables) |
| `PUBLIC_URL` | var | base URL used in asset links (default: request origin) |

## Costs

Per device launch: one Worker request for `/v1/check` (D1 reads amortized by the per-colo cache)
and, only when there is an update, one request per *changed* file, mostly served from the edge
cache. R2 has no egress fees.

### Staying on the free tier

A small-to-medium fleet fits in Cloudflare's free tier with nothing to downgrade later:

- Workers custom domains are free — attaching `ota.example.com` (or the production
  `airdrop-api.guhcostan.dev` / `airdrop.guhcostan.dev`) via the dashboard costs nothing
  and is intentionally not declared in `wrangler.jsonc`, so deploys never detach it.
- One D1 database (`airdrop`) and one R2 bucket (`airdrop-assets`) stay far below the
  free quotas at this scale; no paid bindings (AI, Vectorize, Queues, Durable Objects)
  are used anywhere in `apps/*/wrangler.jsonc` (rate-limit bindings and the nightly cron are free).
- `observability.enabled` uses the default Workers Logs retention — no Logpush or
  paid logging add-ons.

## Running the service

| what | how |
|---|---|
| Health | `ops-daily.yml` runs `e2e/prod-smoke.sh` against production every day; GitHub emails you when it fails. Worker logs: Cloudflare dashboard → Workers → airdrop-server → Logs (observability is on). |
| New signups | `ops-daily.yml` opens an issue "Early access: N new signup(s)"; or run `airdrop waitlist`. |
| Onboarding | `airdrop apps create "<name>"`, `airdrop tokens create "<name>" --app <id>`, send the token. |
| Plans | `airdrop apps plan <appId> free\|pro\|scale\|enterprise`. Over the monthly-active-device limit (+10%) new releases are blocked (402); devices keep working. Storage over the plan returns 413 on upload. |
| Abuse limits | `ratelimits` in `apps/server/wrangler.jsonc` (waitlist, failed tokens, update checks per device). |
| Cleanup | nightly cron (`src/maintenance.ts`): unpublished files after 7 days, metering older than 3 months. |
| Customer deletes their data | `DELETE /v1/apps/:id` with their token removes the app, updates, files, metering and tokens. |

## Backups and restore

- **Point in time**: D1 Time Travel (30 days on Workers Paid, 7 on Free):
  `npx wrangler d1 time-travel info airdrop` / `npx wrangler d1 time-travel restore airdrop --timestamp <unix|ISO>`.
- **Weekly SQL dumps**: `backup-d1.yml` exports the database to `airdrop-assets/backups/*.sql.gz`
  (expired after 35 days). Restore into a fresh database:

  ```sh
  npx wrangler r2 object get airdrop-assets/backups/<file>.sql.gz --file dump.sql.gz --remote && gunzip dump.sql.gz
  npx wrangler d1 create airdrop-restore && npx wrangler d1 execute airdrop-restore --remote --file dump.sql
  ```

  then point `database_id` in `wrangler.jsonc` at it (or copy tables back) and redeploy.
- **Files** (R2) are content-addressed and never modified; deleting an app removes its prefix.

## Billing (Stripe)

Billing is off until configured; until then the dashboard shows "Talk to us" and you set plans with
`airdrop apps plan`. To turn it on:

1. In Stripe, create two products with a **monthly recurring price**: *Airdrop Pro* ($19) and *Airdrop Scale* ($79).
   Note the price ids (`price_…`).
2. Add a webhook endpoint `https://airdrop-api.guhcostan.dev/v1/billing/webhook` with the events
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Note its signing secret (`whsec_…`).
3. Enable the **Customer portal** (Stripe → Settings → Billing → Customer portal).
4. Configure the worker:

   ```sh
   cd apps/server
   npx wrangler secret put STRIPE_SECRET_KEY        # sk_live_… (or a restricted key)
   npx wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_…
   npx wrangler secret put STRIPE_PRICE_PRO         # price_…
   npx wrangler secret put STRIPE_PRICE_SCALE       # price_…
   ```

Plans then change only from verified webhooks: upgrade → `pro`/`scale`; cancelled or unpaid → `free`.
Enterprise stays manual (`airdrop apps plan <id> enterprise`).
