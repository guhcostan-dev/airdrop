import { PLATFORMS, type Platform, type PublishUpdateRequest, type UpdateFile } from "./protocol";

export const SHA256_RE = /^[0-9a-f]{64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Channels and runtime versions: printable, no whitespace, no path tricks. */
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+\-]{0,63}$/;

export class ValidationError extends Error {}

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/**
 * Relative path inside an update. Rejects absolute paths, `..`, backslashes and
 * anything that could escape the update directory on the device.
 */
export function isSafeRelativePath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 512) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  if (path === "airdrop-manifest.json") return false;
  return path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

function assertFile(file: unknown, label: string): asserts file is UpdateFile {
  const f = file as Partial<UpdateFile> | null;
  if (!f || typeof f !== "object") throw new ValidationError(`${label}: must be an object`);
  if (!isSafeRelativePath(f.path)) throw new ValidationError(`${label}: invalid path`);
  if (typeof f.hash !== "string" || !SHA256_RE.test(f.hash))
    throw new ValidationError(`${label}: hash must be lowercase hex sha256`);
  if (typeof f.size !== "number" || !Number.isInteger(f.size) || f.size < 0)
    throw new ValidationError(`${label}: invalid size`);
}

export function validatePublishRequest(body: unknown): PublishUpdateRequest {
  const b = body as Partial<PublishUpdateRequest> | null;
  if (!b || typeof b !== "object") throw new ValidationError("body must be a JSON object");
  if (typeof b.id !== "string" || !UUID_RE.test(b.id)) throw new ValidationError("id must be a lowercase UUID");
  if (typeof b.channel !== "string" || !NAME_RE.test(b.channel)) throw new ValidationError("invalid channel");
  if (!isPlatform(b.platform)) throw new ValidationError("platform must be ios or android");
  if (typeof b.runtimeVersion !== "string" || !NAME_RE.test(b.runtimeVersion))
    throw new ValidationError("invalid runtimeVersion");
  if (b.message !== undefined && (typeof b.message !== "string" || b.message.length > 1000))
    throw new ValidationError("message must be a string up to 1000 chars");
  if (b.mandatory !== undefined && typeof b.mandatory !== "boolean")
    throw new ValidationError("mandatory must be boolean");
  if (
    b.rolloutPercentage !== undefined &&
    (!Number.isInteger(b.rolloutPercentage) || b.rolloutPercentage < 1 || b.rolloutPercentage > 100)
  )
    throw new ValidationError("rolloutPercentage must be an integer between 1 and 100");
  assertFile(b.launchAsset, "launchAsset");
  if (!Array.isArray(b.assets) || b.assets.length > 5000) throw new ValidationError("assets must be an array");
  const seen = new Set<string>([b.launchAsset.path]);
  b.assets.forEach((a, i) => {
    assertFile(a, `assets[${i}]`);
    if (seen.has(a.path)) throw new ValidationError(`duplicate path ${a.path}`);
    seen.add(a.path);
  });
  if (b.signature !== undefined && (typeof b.signature !== "string" || b.signature.length > 512))
    throw new ValidationError("signature must be base64");
  return {
    id: b.id,
    channel: b.channel,
    platform: b.platform,
    runtimeVersion: b.runtimeVersion,
    message: b.message,
    mandatory: b.mandatory ?? false,
    rolloutPercentage: b.rolloutPercentage ?? 100,
    launchAsset: { path: b.launchAsset.path, hash: b.launchAsset.hash, size: b.launchAsset.size },
    assets: b.assets.map((a) => ({ path: a.path, hash: a.hash, size: a.size })),
    signature: b.signature,
  };
}
