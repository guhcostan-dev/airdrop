import type { Env } from "./env";
import { sha256Hex } from "./util";

/** Current UTC month, "YYYY-MM". */
export function currentMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

// Per-isolate state. Each device costs at most one D1 write per month per isolate; the
// INSERT OR IGNORE makes duplicates across isolates harmless. /v1/check never waits on it.
let month = currentMonth();
const seen = new Set<string>();
let pending: { appId: string; device: string }[] = [];
let flushScheduled = false;
const MAX_SEEN = 200_000;
const BATCH = 100;

async function flush(env: Env): Promise<void> {
  flushScheduled = false;
  const rows = pending;
  pending = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await env.DB.batch(
      chunk.map((r) =>
        env.DB.prepare("INSERT OR IGNORE INTO active_devices (app_id, month, device) VALUES (?, ?, ?)").bind(
          r.appId,
          month,
          r.device,
        ),
      ),
    );
  }
}

/** Notes a device as active this month. Writes happen after the response, in batches. */
export function recordActiveDevice(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
  appId: string,
  deviceId: string,
): Promise<void> {
  const m = currentMonth();
  if (m !== month) {
    month = m;
    seen.clear();
  }
  const key = `${appId}:${deviceId}`;
  if (seen.has(key)) return Promise.resolve();
  if (seen.size >= MAX_SEEN) seen.clear();
  seen.add(key);

  const work = (async () => {
    pending.push({ appId, device: (await sha256Hex(key)).slice(0, 32) });
    const delay = Number(env.USAGE_FLUSH_MS ?? "2000");
    if (pending.length >= BATCH || delay === 0) return flush(env);
    if (flushScheduled) return;
    flushScheduled = true;
    await new Promise((r) => setTimeout(r, delay));
    await flush(env);
  })().catch((err) => console.error("usage flush failed", err));
  ctx.waitUntil(work);
  return work;
}

export async function activeDevices(env: Env, appId: string, m = currentMonth()): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM active_devices WHERE app_id = ? AND month = ?")
    .bind(appId, m)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function storedBytes(env: Env, appId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COALESCE(SUM(stored_bytes), 0) AS n FROM assets WHERE app_id = ?")
    .bind(appId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Test hook: forget per-isolate dedupe state. */
export function resetUsageState(): void {
  seen.clear();
  pending = [];
  flushScheduled = false;
  month = currentMonth();
}
