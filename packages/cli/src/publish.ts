import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Platform, PublishUpdateRequest, UpdateFile } from "@rn-airdrop/core";
import type { Api, UpdateInfo } from "./api";
import { signUpdate } from "./signing";
import { formatBytes, log } from "./ui";

export interface PublishOptions {
  api: Api;
  appId: string;
  dir: string;
  launchAsset: UpdateFile;
  assets: UpdateFile[];
  platform: Platform;
  runtimeVersion: string;
  channel: string;
  message?: string;
  mandatory?: boolean;
  rolloutPercentage?: number;
  privateKey?: crypto.KeyObject;
  concurrency?: number;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

/** Uploads only files the server does not have yet (content-addressed), then publishes. */
export async function publishBundle(opts: PublishOptions): Promise<UpdateInfo> {
  const files = [opts.launchAsset, ...opts.assets];
  const byHash = new Map(files.map((f) => [f.hash, f]));
  const missing = await opts.api.missingAssets(opts.appId, [...byHash.keys()]);
  const total = files.reduce((n, f) => n + f.size, 0);
  log.info(
    `${files.length} files (${formatBytes(total)}), ${missing.length} new to upload, ${byHash.size - missing.length} already on server`,
  );

  let uploaded = 0;
  await pool(missing, opts.concurrency ?? 6, async (hash) => {
    const file = byHash.get(hash)!;
    const gz = zlib.gzipSync(fs.readFileSync(path.join(opts.dir, file.path)), { level: 9 });
    await opts.api.uploadAsset(opts.appId, hash, gz);
    uploaded++;
    log.dim(`  ↑ ${file.path} (${formatBytes(file.size)} → ${formatBytes(gz.byteLength)} gz) [${uploaded}/${missing.length}]`);
  });

  const request: PublishUpdateRequest = {
    id: crypto.randomUUID(),
    channel: opts.channel,
    platform: opts.platform,
    runtimeVersion: opts.runtimeVersion,
    message: opts.message,
    mandatory: opts.mandatory ?? false,
    rolloutPercentage: opts.rolloutPercentage ?? 100,
    launchAsset: opts.launchAsset,
    assets: opts.assets,
  };
  if (opts.privateKey) request.signature = signUpdate(request, opts.privateKey);
  return opts.api.publishUpdate(opts.appId, request);
}
