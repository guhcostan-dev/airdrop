import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./env";
import { clientIp, HttpError, now, overLimit, safeEqual, sha256Hex } from "./util";

/**
 * Accepts the bootstrap ADMIN_TOKEN or any API token stored (hashed) in D1.
 * Sets `tokenAppId`: null for full-access (operator) tokens, the app id for customer tokens
 * that are scoped to a single app.
 */
export const requireToken: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new HttpError(401, "missing bearer token");
  const token = match[1]!;

  if (c.env.ADMIN_TOKEN && (await safeEqual(token, c.env.ADMIN_TOKEN))) {
    c.set("tokenId", "admin");
    c.set("tokenAppId", null);
    return next();
  }

  const hash = await sha256Hex(token);
  const row = await c.env.DB.prepare("SELECT id, app_id FROM api_tokens WHERE token_hash = ?")
    .bind(hash)
    .first<{ id: string; app_id: string | null }>();
  if (!row) {
    // Slow down token guessing: failed attempts are limited per IP.
    if (await overLimit(c.env.RL_AUTH_FAIL, clientIp(c.req))) throw new HttpError(429, "too many failed attempts");
    throw new HttpError(401, "invalid token");
  }
  c.set("tokenId", row.id);
  c.set("tokenAppId", row.app_id);
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").bind(now(), row.id).run(),
  );
  return next();
};

/** Operator-only routes (creating apps, managing tokens, the waitlist). Run after requireToken. */
export const requireFullAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("tokenAppId") !== null) throw new HttpError(403, "this token is scoped to a single app");
  return next();
};

/**
 * Routes under /v1/apps/:appId. A scoped token only sees its own app; any other id is reported
 * as missing so app ids can't be probed. Run after requireToken.
 */
export const requireAppAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  const scope = c.get("tokenAppId");
  if (scope !== null && c.req.param("appId") !== scope) throw new HttpError(404, "app not found");
  return next();
};
