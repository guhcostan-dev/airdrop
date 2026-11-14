import { Hono } from "hono";
import {
  isInRollout,
  isPlatform,
  NAME_RE,
  SHA256_RE,
  UUID_RE,
  type CheckRequest,
  type CheckResponse,
  type EventsRequest,
} from "@rn-airdrop/core";
import { loadCandidates, toManifest } from "../candidates";
import type { AppEnv } from "../env";
import { recordActiveDevice } from "../usage";
import { assetKey, HttpError, overLimit } from "../util";

export const client = new Hono<AppEnv>();

const EVENT_TYPES = new Set(["download", "install", "rollback", "error"]);

function publicOrigin(env: AppEnv["Bindings"], url: string): string {
  return (env.PUBLIC_URL ?? new URL(url).origin).replace(/\/+$/, "");
}

client.post("/v1/check", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<CheckRequest> | null;
  if (!body || typeof body !== "object") throw new HttpError(400, "invalid JSON body");
  const { appId, platform, runtimeVersion, deviceId } = body;
  const channel = body.channel ?? "production";
  const currentUpdateId = body.currentUpdateId ?? null;
  if (typeof appId !== "string" || !UUID_RE.test(appId)) throw new HttpError(400, "invalid appId");
  if (!isPlatform(platform)) throw new HttpError(400, "invalid platform");
  if (typeof runtimeVersion !== "string" || !NAME_RE.test(runtimeVersion))
    throw new HttpError(400, "invalid runtimeVersion");
  if (typeof channel !== "string" || !NAME_RE.test(channel)) throw new HttpError(400, "invalid channel");
  if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 128)
    throw new HttpError(400, "invalid deviceId");
  if (currentUpdateId !== null && (typeof currentUpdateId !== "string" || !UUID_RE.test(currentUpdateId)))
    throw new HttpError(400, "invalid currentUpdateId");

  // Per device, not per IP: thousands of phones can share a carrier NAT address.
  if (await overLimit(c.env.RL_CHECK, `${appId}:${deviceId}`)) throw new HttpError(429, "too many requests");

  const candidates = await loadCandidates(c.env, c.executionCtx, { appId, channel, platform, runtimeVersion });
  // Monthly active devices, for plan limits. Batched after the response (see usage.ts).
  const recorded = recordActiveDevice(c.env, c.executionCtx, appId, deviceId);
  if (c.env.USAGE_FLUSH_MS === "0") await recorded;

  let chosenIndex = -1;
  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i]!;
    if (await isInRollout(deviceId, row.id, row.rollout_percentage)) {
      chosenIndex = i;
      break;
    }
  }

  let response: CheckResponse;
  if (chosenIndex === -1) {
    // Nothing eligible: if the device runs an OTA update it must have been
    // disabled (or rolled back), so send it back to the embedded bundle.
    response = currentUpdateId ? { status: "rollbackToEmbedded" } : { status: "noUpdate" };
  } else {
    const chosen = candidates[chosenIndex]!;
    if (chosen.id === currentUpdateId) {
      response = { status: "noUpdate" };
    } else {
      const manifest = toManifest(chosen, publicOrigin(c.env, c.req.url));
      // If the device skips over a mandatory update, the one it receives is mandatory too.
      const currentIndex = candidates.findIndex((r) => r.id === currentUpdateId);
      if (currentIndex > chosenIndex) {
        manifest.mandatory = candidates.slice(chosenIndex, currentIndex).some((r) => r.mandatory === 1);
      }
      response = { status: "update", update: manifest };
    }
  }

  return c.json(response, 200, { "cache-control": "no-store" });
});

client.post("/v1/events", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<EventsRequest> | null;
  if (!body || typeof body.appId !== "string" || !UUID_RE.test(body.appId))
    throw new HttpError(400, "invalid appId");
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 50)
    throw new HttpError(400, "events must be a non-empty array (max 50)");

  const stmts = [];
  for (const e of body.events) {
    if (!e || !EVENT_TYPES.has(e.type) || typeof e.updateId !== "string" || !UUID_RE.test(e.updateId)) continue;
    // The SELECT guards against counting events for updates of other apps.
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO update_stats (update_id, type, count)
         SELECT id, ?, 1 FROM updates WHERE id = ? AND app_id = ?
         ON CONFLICT (update_id, type) DO UPDATE SET count = count + 1`,
      ).bind(e.type, e.updateId, body.appId),
    );
  }
  if (stmts.length) c.executionCtx.waitUntil(c.env.DB.batch(stmts));
  return c.body(null, 202);
});

client.get("/v1/assets/:appId/:hash", async (c) => {
  const { appId, hash } = c.req.param();
  if (!UUID_RE.test(appId) || !SHA256_RE.test(hash)) throw new HttpError(404, "not found");

  // Content-addressed => immutable. Serve from the colo cache before hitting R2/S3.
  const canUseCache = typeof caches !== "undefined" && typeof caches.open === "function";
  const cache = canUseCache ? await caches.open("airdrop-assets") : null;
  const cacheKey = new Request(new URL(c.req.url).toString());
  const hit = cache ? await cache.match(cacheKey) : null;
  // The cached body is still the stored gzip: pass it through as-is, or the runtime would
  // compress it a second time for clients that send Accept-Encoding.
  if (hit) return new Response(hit.body, { status: hit.status, headers: hit.headers, encodeBody: "manual" });

  const object = await c.env.BUCKET.get(assetKey(appId, hash));
  if (!object) throw new HttpError(404, "not found");

  const headers = new Headers({
    "content-type": "application/octet-stream",
    // Stored gzip-compressed; every HTTP stack used by RN apps decodes it transparently.
    "content-encoding": "gzip",
    "cache-control": "public, max-age=31536000, immutable",
    etag: `"${hash}"`,
  });
  if (object.size) headers.set("x-airdrop-compressed-size", String(object.size));
  const init = { headers, encodeBody: "manual" as const };
  if (cache) {
    const [toClient, toCache] = object.body.tee();
    c.executionCtx.waitUntil(cache.put(cacheKey, new Response(toCache, init)));
    return new Response(toClient, init);
  }
  return new Response(object.body, init);
});
