import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  isPlatform,
  NAME_RE,
  SHA256_RE,
  UUID_RE,
  validatePublishRequest,
  ValidationError,
} from "@rn-airdrop/core";
import { requireAppAccess, requireFullAccess, requireToken } from "../auth";
import { toManifest, type StoredManifest, type UpdateRow } from "../candidates";
import type { AppEnv } from "../env";
import { isPlan, MAU_GRACE, PLANS, type PlanId } from "../plans";
import { activeDevices, currentMonth, storedBytes } from "../usage";
import { assetKey, HttpError, now, randomToken, sha256Hex, toHex } from "../util";

export const admin = new Hono<AppEnv>();
// The website's dashboard calls these routes from the browser with an app token (header, not cookie).
const dashboardCors = cors({
  origin: (origin, c) => ((c.env.WEB_ORIGINS ?? "").split(",").map((s: string) => s.trim()).includes(origin) ? origin : null),
  allowMethods: ["GET", "PATCH", "DELETE"],
  allowHeaders: ["authorization", "content-type"],
  maxAge: 86400,
});
admin.use("/v1/apps", dashboardCors);
admin.use("/v1/apps/*", dashboardCors);
admin.use("/v1/apps", requireToken);
admin.use("/v1/apps/*", requireToken);
admin.use("/v1/apps/:appId", requireAppAccess);
admin.use("/v1/apps/:appId/*", requireAppAccess);
for (const p of ["/v1/tokens", "/v1/tokens/*"]) admin.use(p, requireToken, requireFullAccess);

/** Max size of a single (uncompressed) file in an update. */
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const P256_POINT_RE = /^[A-Za-z0-9+/]{86}[A-Za-z0-9+/=]{2}$/;

interface AppRow {
  id: string;
  name: string;
  signing_public_key: string | null;
  plan: PlanId;
  created_at: number;
}

function appJson(row: AppRow) {
  return {
    id: row.id,
    name: row.name,
    signingPublicKey: row.signing_public_key,
    plan: row.plan,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function getApp(env: AppEnv["Bindings"], appId: string): Promise<AppRow> {
  if (!UUID_RE.test(appId)) throw new HttpError(404, "app not found");
  const row = await env.DB.prepare("SELECT * FROM apps WHERE id = ?").bind(appId).first<AppRow>();
  if (!row) throw new HttpError(404, "app not found");
  return row;
}

function parsePublicKey(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !P256_POINT_RE.test(value))
    throw new HttpError(400, "signingPublicKey must be a base64 uncompressed P-256 point (65 bytes)");
  return value;
}

// ---------------------------------------------------------------- apps

admin.get("/v1/apps", async (c) => {
  const scope = c.get("tokenAppId");
  const { results } = await (scope === null
    ? c.env.DB.prepare("SELECT * FROM apps ORDER BY created_at")
    : c.env.DB.prepare("SELECT * FROM apps WHERE id = ?").bind(scope)
  ).all<AppRow>();
  return c.json({ apps: results.map(appJson) });
});

admin.post("/v1/apps", requireFullAccess, async (c) => {
  const body = await c.req.json<{ name?: unknown; signingPublicKey?: unknown }>().catch(() => ({}) as never);
  if (typeof body.name !== "string" || body.name.trim().length === 0 || body.name.length > 100)
    throw new HttpError(400, "name is required");
  const row: AppRow = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    signing_public_key: parsePublicKey(body.signingPublicKey),
    plan: "free",
    created_at: now(),
  };
  await c.env.DB.prepare("INSERT INTO apps (id, name, signing_public_key, created_at) VALUES (?, ?, ?, ?)")
    .bind(row.id, row.name, row.signing_public_key, row.created_at)
    .run();
  return c.json(appJson(row), 201);
});

admin.get("/v1/apps/:appId", async (c) => c.json(appJson(await getApp(c.env, c.req.param("appId")))));

admin.patch("/v1/apps/:appId", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const body = await c.req
    .json<{ name?: unknown; signingPublicKey?: unknown; plan?: unknown }>()
    .catch(() => ({}) as never);
  if (body.plan !== undefined) {
    if (c.get("tokenAppId") !== null) throw new HttpError(403, "plans are changed by Airdrop, not with an app token");
    if (!isPlan(body.plan)) throw new HttpError(400, `plan must be one of: ${Object.keys(PLANS).join(", ")}`);
    app.plan = body.plan;
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) throw new HttpError(400, "invalid name");
    app.name = body.name.trim();
  }
  if (body.signingPublicKey !== undefined) app.signing_public_key = parsePublicKey(body.signingPublicKey);
  await c.env.DB.prepare("UPDATE apps SET name = ?, signing_public_key = ?, plan = ? WHERE id = ?")
    .bind(app.name, app.signing_public_key, app.plan, app.id)
    .run();
  return c.json(appJson(app));
});

async function usageOf(env: AppEnv["Bindings"], app: AppRow) {
  const limits = PLANS[app.plan] ?? PLANS.free;
  const [mau, bytes] = await Promise.all([activeDevices(env, app.id), storedBytes(env, app.id)]);
  return {
    month: currentMonth(),
    plan: app.plan,
    activeDevices: mau,
    activeDevicesLimit: limits.mau,
    storageBytes: bytes,
    storageBytesLimit: limits.storageBytes,
    overLimit: limits.mau !== null && mau > limits.mau * MAU_GRACE,
  };
}

admin.get("/v1/apps/:appId/usage", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  return c.json(await usageOf(c.env, app));
});

admin.delete("/v1/apps/:appId", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM update_stats WHERE update_id IN (SELECT id FROM updates WHERE app_id = ?)").bind(
      app.id,
    ),
    c.env.DB.prepare("DELETE FROM updates WHERE app_id = ?").bind(app.id),
    c.env.DB.prepare("DELETE FROM active_devices WHERE app_id = ?").bind(app.id),
    c.env.DB.prepare("DELETE FROM assets WHERE app_id = ?").bind(app.id),
    c.env.DB.prepare("DELETE FROM api_tokens WHERE app_id = ?").bind(app.id),
    c.env.DB.prepare("DELETE FROM apps WHERE id = ?").bind(app.id),
  ]);
  c.executionCtx.waitUntil(deletePrefix(c.env.BUCKET, `apps/${app.id}/`));
  return c.body(null, 204);
});

async function deletePrefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

// ---------------------------------------------------------------- assets

admin.post("/v1/apps/:appId/assets/missing", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const body = await c.req.json<{ hashes?: unknown }>().catch(() => ({}) as never);
  if (!Array.isArray(body.hashes) || body.hashes.length > 5000) throw new HttpError(400, "hashes must be an array");
  const hashes = [...new Set(body.hashes)].filter((h): h is string => typeof h === "string" && SHA256_RE.test(h));
  const heads = await Promise.all(hashes.map((h) => c.env.BUCKET.head(assetKey(app.id, h))));
  return c.json({ missing: hashes.filter((_, i) => !heads[i]) });
});

/**
 * Upload one file. Body is the gzip-compressed file; the server decompresses
 * it to verify the SHA-256 in the URL before storing, so a hash in the DB
 * always matches the bytes devices receive.
 */
admin.put("/v1/apps/:appId/assets/:hash", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const hash = c.req.param("hash");
  if (!SHA256_RE.test(hash)) throw new HttpError(400, "invalid hash");
  const compressed = await c.req.arrayBuffer();
  if (compressed.byteLength === 0) throw new HttpError(400, "empty body");

  let size = 0;
  const chunks: Uint8Array[] = [];
  const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ASSET_BYTES) throw new HttpError(413, "asset too large");
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "body must be gzip-compressed");
  }
  const uncompressed = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    uncompressed.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const actual = toHex(await crypto.subtle.digest("SHA-256", uncompressed));
  if (actual !== hash) throw new HttpError(422, `hash mismatch: expected ${hash}, got ${actual}`);

  const limit = (PLANS[app.plan] ?? PLANS.free).storageBytes;
  if (limit !== null && (await storedBytes(c.env, app.id)) + compressed.byteLength > limit)
    throw new HttpError(413, `storage limit of your ${app.plan} plan reached; delete old apps/updates or upgrade`);

  await c.env.BUCKET.put(assetKey(app.id, hash), compressed, {
    httpMetadata: { contentType: "application/octet-stream", contentEncoding: "gzip" },
    customMetadata: { size: String(size) },
  });
  await c.env.DB.prepare(
    "INSERT INTO assets (app_id, hash, stored_bytes, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
  )
    .bind(app.id, hash, compressed.byteLength, now())
    .run();
  return c.json({ hash, size }, 201);
});

// ---------------------------------------------------------------- updates

function updateJson(row: UpdateRow, origin: string, stats?: Record<string, number>) {
  return {
    ...toManifest(row, origin),
    rolloutPercentage: row.rollout_percentage,
    enabled: row.enabled === 1,
    totalSize: row.total_size,
    ...(stats ? { stats } : {}),
  };
}

function origin(c: { env: AppEnv["Bindings"]; req: { url: string } }) {
  return (c.env.PUBLIC_URL ?? new URL(c.req.url).origin).replace(/\/+$/, "");
}

admin.post("/v1/apps/:appId/updates", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  let req;
  try {
    req = validatePublishRequest(await c.req.json().catch(() => null));
  } catch (err) {
    if (err instanceof ValidationError) throw new HttpError(400, err.message);
    throw err;
  }
  if (app.signing_public_key && !req.signature)
    throw new HttpError(400, "this app has a signing key configured; updates must be signed");
  const usage = await usageOf(c.env, app);
  if (usage.overLimit)
    throw new HttpError(
      402,
      `${usage.activeDevices} monthly active devices is over the ${usage.activeDevicesLimit} of your ${app.plan} plan. ` +
        "Devices keep receiving existing updates; upgrade to publish new ones.",
    );

  const files = [req.launchAsset, ...req.assets];
  const unique = [...new Set(files.map((f) => f.hash))];
  const heads = await Promise.all(unique.map((h) => c.env.BUCKET.head(assetKey(app.id, h))));
  const missing = unique.filter((_, i) => !heads[i]);
  if (missing.length) throw new HttpError(409, `missing assets: ${missing.slice(0, 5).join(", ")}`);

  const stored: StoredManifest = { launchAsset: req.launchAsset, assets: req.assets, signature: req.signature ?? null };
  const row: UpdateRow = {
    id: req.id,
    app_id: app.id,
    channel: req.channel,
    platform: req.platform,
    runtime_version: req.runtimeVersion,
    message: req.message ?? null,
    mandatory: req.mandatory ? 1 : 0,
    rollout_percentage: req.rolloutPercentage ?? 100,
    enabled: 1,
    manifest: JSON.stringify(stored),
    total_size: files.reduce((n, f) => n + f.size, 0),
    created_at: now(),
  };
  try {
    await insertUpdate(c.env.DB, row);
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError(409, "an update with this id already exists");
    throw err;
  }
  return c.json(updateJson(row, origin(c)), 201);
});

function insertUpdate(db: D1Database, row: UpdateRow) {
  return db
    .prepare(
      `INSERT INTO updates (id, app_id, channel, platform, runtime_version, message, mandatory,
         rollout_percentage, enabled, manifest, total_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.app_id,
      row.channel,
      row.platform,
      row.runtime_version,
      row.message,
      row.mandatory,
      row.rollout_percentage,
      row.enabled,
      row.manifest,
      row.total_size,
      row.created_at,
    )
    .run();
}

admin.get("/v1/apps/:appId/updates", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const { channel, platform, runtimeVersion } = c.req.query();
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20) || 20, 1), 100);
  const where = ["app_id = ?"];
  const params: unknown[] = [app.id];
  if (channel) {
    if (!NAME_RE.test(channel)) throw new HttpError(400, "invalid channel");
    where.push("channel = ?");
    params.push(channel);
  }
  if (platform) {
    if (!isPlatform(platform)) throw new HttpError(400, "invalid platform");
    where.push("platform = ?");
    params.push(platform);
  }
  if (runtimeVersion) {
    where.push("runtime_version = ?");
    params.push(runtimeVersion);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM updates WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(...params, limit)
    .all<UpdateRow>();
  const stats = await loadStats(
    c.env.DB,
    results.map((r) => r.id),
  );
  return c.json({ updates: results.map((r) => updateJson(r, origin(c), stats[r.id] ?? {})) });
});

async function loadStats(db: D1Database, ids: string[]): Promise<Record<string, Record<string, number>>> {
  if (!ids.length) return {};
  const { results } = await db
    .prepare(`SELECT * FROM update_stats WHERE update_id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<{ update_id: string; type: string; count: number }>();
  const out: Record<string, Record<string, number>> = {};
  for (const r of results) (out[r.update_id] ??= {})[r.type] = r.count;
  return out;
}

async function getUpdate(db: D1Database, appId: string, id: string): Promise<UpdateRow> {
  if (!UUID_RE.test(id)) throw new HttpError(404, "update not found");
  const row = await db.prepare("SELECT * FROM updates WHERE id = ? AND app_id = ?").bind(id, appId).first<UpdateRow>();
  if (!row) throw new HttpError(404, "update not found");
  return row;
}

admin.get("/v1/apps/:appId/updates/:id", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const row = await getUpdate(c.env.DB, app.id, c.req.param("id"));
  const stats = await loadStats(c.env.DB, [row.id]);
  return c.json(updateJson(row, origin(c), stats[row.id] ?? {}));
});

/** Change rollout, pause/resume (enabled) or mandatory flag. Disabling = rollback. */
admin.patch("/v1/apps/:appId/updates/:id", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const row = await getUpdate(c.env.DB, app.id, c.req.param("id"));
  const body = await c.req
    .json<{ enabled?: unknown; rolloutPercentage?: unknown; mandatory?: unknown }>()
    .catch(() => ({}) as never);
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") throw new HttpError(400, "enabled must be boolean");
    row.enabled = body.enabled ? 1 : 0;
  }
  if (body.mandatory !== undefined) {
    if (typeof body.mandatory !== "boolean") throw new HttpError(400, "mandatory must be boolean");
    row.mandatory = body.mandatory ? 1 : 0;
  }
  if (body.rolloutPercentage !== undefined) {
    const p = body.rolloutPercentage;
    if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 100)
      throw new HttpError(400, "rolloutPercentage must be an integer between 1 and 100");
    row.rollout_percentage = p;
  }
  await c.env.DB.prepare("UPDATE updates SET enabled = ?, mandatory = ?, rollout_percentage = ? WHERE id = ?")
    .bind(row.enabled, row.mandatory, row.rollout_percentage, row.id)
    .run();
  return c.json(updateJson(row, origin(c)));
});

/** Copy an update to another channel (e.g. staging -> production). Files are shared. */
admin.post("/v1/apps/:appId/updates/:id/promote", async (c) => {
  const app = await getApp(c.env, c.req.param("appId"));
  const source = await getUpdate(c.env.DB, app.id, c.req.param("id"));
  const body = await c.req
    .json<{ channel?: unknown; rolloutPercentage?: unknown; mandatory?: unknown; message?: unknown }>()
    .catch(() => ({}) as never);
  if (typeof body.channel !== "string" || !NAME_RE.test(body.channel)) throw new HttpError(400, "invalid channel");
  const rollout = body.rolloutPercentage ?? 100;
  if (typeof rollout !== "number" || !Number.isInteger(rollout) || rollout < 1 || rollout > 100)
    throw new HttpError(400, "rolloutPercentage must be an integer between 1 and 100");
  const row: UpdateRow = {
    ...source,
    id: crypto.randomUUID(),
    channel: body.channel,
    rollout_percentage: rollout,
    mandatory: body.mandatory === undefined ? source.mandatory : body.mandatory ? 1 : 0,
    message: typeof body.message === "string" ? body.message : source.message,
    enabled: 1,
    created_at: now(),
  };
  await insertUpdate(c.env.DB, row);
  return c.json(updateJson(row, origin(c)), 201);
});

// ---------------------------------------------------------------- API tokens

admin.get("/v1/tokens", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, app_id, created_at, last_used_at FROM api_tokens ORDER BY created_at",
  ).all<{ id: string; name: string; app_id: string | null; created_at: number; last_used_at: number | null }>();
  return c.json({
    tokens: results.map((t) => ({
      id: t.id,
      name: t.name,
      appId: t.app_id,
      createdAt: new Date(t.created_at).toISOString(),
      lastUsedAt: t.last_used_at ? new Date(t.last_used_at).toISOString() : null,
    })),
  });
});

admin.post("/v1/tokens", async (c) => {
  const body = await c.req.json<{ name?: unknown; appId?: unknown }>().catch(() => ({}) as never);
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100)
    throw new HttpError(400, "name is required");
  let appId: string | null = null;
  if (body.appId !== undefined && body.appId !== null) {
    if (typeof body.appId !== "string") throw new HttpError(400, "appId must be a string");
    appId = (await getApp(c.env, body.appId)).id;
  }
  const token = randomToken("ad_");
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO api_tokens (id, name, token_hash, app_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, body.name.trim(), await sha256Hex(token), appId, now())
    .run();
  return c.json({ id, name: body.name.trim(), appId, token }, 201);
});

admin.delete("/v1/tokens/:id", async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM api_tokens WHERE id = ?").bind(c.req.param("id")).run();
  if (!res.meta.changes) throw new HttpError(404, "token not found");
  return c.body(null, 204);
});

// ---------------------------------------------------------------- waitlist (operator view)

admin.get("/v1/waitlist", requireToken, requireFullAccess, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT email, app_name, mau, created_at FROM waitlist ORDER BY created_at DESC",
  ).all<{ email: string; app_name: string | null; mau: string | null; created_at: number }>();
  return c.json({
    entries: results.map((r) => ({
      email: r.email,
      appName: r.app_name,
      mau: r.mau,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  });
});
