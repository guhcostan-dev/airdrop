interface RateLimit {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  /** Rate limiters (optional so the worker still runs where they aren't configured). */
  RL_WAITLIST?: RateLimit;
  RL_AUTH_FAIL?: RateLimit;
  RL_CHECK?: RateLimit;
  /** Bootstrap admin token (secret). */
  ADMIN_TOKEN?: string;
  /** Seconds to cache the candidate list for /v1/check per colo ("0" disables). */
  CHECK_CACHE_TTL?: string;
  /** Optional public base URL for asset downloads (e.g. an R2 custom domain proxied through this worker). */
  PUBLIC_URL?: string;
  /** Comma-separated origins allowed to POST /v1/waitlist from the browser (the website). */
  WEB_ORIGINS?: string;
  /** Delay before batching active-device writes (ms). "0" writes before the response (tests). */
  USAGE_FLUSH_MS?: string;
  /** Stripe billing (all optional; billing is disabled until set). Secrets: key + webhook secret. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_SCALE?: string;
  /** Website base URL for Stripe redirects (default https://airdrop.guhcostan.dev). */
  SITE_URL?: string;
  /** Optional AWS Lambda Function URL origin when Cloudflare Worker acts as DNS/Edge proxy. */
  AWS_ORIGIN?: string;
}

export type AppEnv = { Bindings: Env; Variables: { tokenId: string; tokenAppId: string | null } };
