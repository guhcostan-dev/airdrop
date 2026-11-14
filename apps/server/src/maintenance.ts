import type { Env } from "./env";
import { assetKey, now } from "./util";

/** Files uploaded but never published are kept this long (a release in progress may still use them). */
const ORPHAN_GRACE_MS = 7 * 24 * 3600 * 1000;
/** Monthly-active-device rows older than this many months are dropped. */
const KEEP_MONTHS = 3;
const BATCH = 500;

export interface MaintenanceReport {
  backfilledAssets: number;
  deletedOrphans: number;
  prunedDeviceRows: number;
}

/**
 * Nightly cron (wrangler.jsonc "triggers"). Idempotent and bounded per run, so a big backlog
 * is simply worked through over several nights.
 */
export async function runMaintenance(env: Env, at = new Date()): Promise<MaintenanceReport> {
  return {
    backfilledAssets: await backfillAssets(env),
    deletedOrphans: await deleteOrphans(env, at.getTime() - ORPHAN_GRACE_MS),
    prunedDeviceRows: await pruneDevices(env, at),
  };
}

/** Files stored before the `assets` table existed: register them once so quotas and cleanup see them. */
async function backfillAssets(env: Env): Promise<number> {
  const done = await env.DB.prepare("SELECT value FROM meta WHERE key = 'assets_backfilled'").first();
  if (done) return 0;
  let cursor: string | undefined;
  let count = 0;
  do {
    const page = await env.BUCKET.list({ prefix: "apps/", cursor, limit: 1000 });
    const stmts = [];
    for (const o of page.objects) {
      const m = /^apps\/([^/]+)\/assets\/([0-9a-f]{64})$/.exec(o.key);
      if (!m) continue;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO assets (app_id, hash, stored_bytes, created_at)
           SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM apps WHERE id = ?) ON CONFLICT DO NOTHING`,
        ).bind(m[1], m[2], o.size, o.uploaded.getTime(), m[1]),
      );
    }
    for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
    count += stmts.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('assets_backfilled', ?)").bind(String(now())).run();
  return count;
}

async function deleteOrphans(env: Env, olderThan: number): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT a.app_id, a.hash FROM assets a
     WHERE a.created_at < ?
       AND NOT EXISTS (
         SELECT 1 FROM updates u
         WHERE u.app_id = a.app_id
           AND (json_extract(u.manifest, '$.launchAsset.hash') = a.hash
                OR EXISTS (SELECT 1 FROM json_each(u.manifest, '$.assets') j
                           WHERE json_extract(j.value, '$.hash') = a.hash)))
     LIMIT ?`,
  )
    .bind(olderThan, BATCH)
    .all<{ app_id: string; hash: string }>();
  if (!results.length) return 0;
  await env.BUCKET.delete(results.map((r) => assetKey(r.app_id, r.hash)));
  await env.DB.batch(
    results.map((r) => env.DB.prepare("DELETE FROM assets WHERE app_id = ? AND hash = ?").bind(r.app_id, r.hash)),
  );
  return results.length;
}

async function pruneDevices(env: Env, at: Date): Promise<number> {
  const cutoff = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - KEEP_MONTHS + 1, 1)).toISOString().slice(0, 7);
  const res = await env.DB.prepare("DELETE FROM active_devices WHERE month < ?").bind(cutoff).run();
  return res.meta.changes ?? 0;
}
