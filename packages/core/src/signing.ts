import type { Platform, UpdateFile } from "./protocol";

export interface SignableUpdate {
  runtimeVersion: string;
  platform: Platform;
  launchAsset: Pick<UpdateFile, "path" | "hash">;
  assets: Pick<UpdateFile, "path" | "hash">[];
}

/**
 * Canonical byte string that gets signed. Deliberately trivial so that the
 * Objective-C and Java clients can rebuild it without a JSON canonicalizer:
 *
 *   airdrop-v1\n<runtimeVersion>\n<platform>\n<launchPath>:<launchHash>\n<path>:<hash>...
 *
 * Assets are sorted by path using plain code-unit comparison (paths are ASCII
 * in practice, which makes this identical to byte order on every platform).
 *
 * The update id is intentionally *not* covered so an update can be promoted
 * between channels (which creates a new id) without re-signing.
 */
export function signingMessage(update: SignableUpdate): string {
  const assets = [...update.assets]
    .map((a) => `${a.path}:${a.hash}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [
    "airdrop-v1",
    update.runtimeVersion,
    update.platform,
    `${update.launchAsset.path}:${update.launchAsset.hash}`,
    ...assets,
  ].join("\n");
}
