import type { Platform, ServedFile, UpdateFile, UpdateManifest } from "@rn-airdrop/core";
import type { Env } from "./env";

export interface UpdateRow {
  id: string;
  app_id: string;
  channel: string;
  platform: Platform;
  runtime_version: string;
  message: string | null;
  mandatory: number;
  rollout_percentage: number;
  enabled: number;
  manifest: string;
  total_size: number;
  created_at: number;
}

export interface StoredManifest {
  launchAsset: UpdateFile;
  assets: UpdateFile[];
  signature: string | null;
}

export interface CandidateQuery {
  appId: string;
  channel: string;
  platform: Platform;
  runtimeVersion: string;
}

const MAX_CANDIDATES = 20;

/**
 * Most recent enabled updates for a target, newest first. This is the only
 * D1 read on the hot path and it is cached per colo for CHECK_CACHE_TTL
 * seconds, so a fleet of devices checking at app start costs ~1 query/colo.
 */
export async function loadCandidates(
  env: Env,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  q: CandidateQuery,
): Promise<UpdateRow[]> {
  const ttl = Number(env.CHECK_CACHE_TTL ?? "10");
  const cacheKey = new Request(
    `https://airdrop.cache/candidates/${encodeURIComponent(q.appId)}/${encodeURIComponent(q.channel)}/${q.platform}/${encodeURIComponent(q.runtimeVersion)}`,
  );
  const canUseCache = typeof caches !== "undefined" && typeof caches.open === "function";
  const cache = ttl > 0 && canUseCache ? await caches.open("airdrop") : null;
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json();
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM updates
     WHERE app_id = ? AND channel = ? AND platform = ? AND runtime_version = ? AND enabled = 1
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(q.appId, q.channel, q.platform, q.runtimeVersion, MAX_CANDIDATES)
    .all<UpdateRow>();

  if (cache) {
    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response(JSON.stringify(results), {
          headers: { "content-type": "application/json", "cache-control": `max-age=${ttl}` },
        }),
      ),
    );
  }
  return results;
}

export function toManifest(row: UpdateRow, origin: string): UpdateManifest {
  const stored = JSON.parse(row.manifest) as StoredManifest;
  const serve = (f: UpdateFile): ServedFile => ({
    ...f,
    url: `${origin}/v1/assets/${row.app_id}/${f.hash}`,
  });
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    channel: row.channel,
    platform: row.platform,
    runtimeVersion: row.runtime_version,
    message: row.message,
    mandatory: row.mandatory === 1,
    launchAsset: serve(stored.launchAsset),
    assets: stored.assets.map(serve),
    signature: stored.signature,
  };
}
