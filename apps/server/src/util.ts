export function now(): number {
  return Date.now();
}

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

export function timingSafeEqualBytes(a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array): boolean {
  const ua = a instanceof Uint8Array ? a : new Uint8Array(a);
  const ub = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (ua.byteLength !== ub.byteLength) return false;
  const subtle = crypto.subtle as unknown as { timingSafeEqual?: (x: Uint8Array, y: Uint8Array) => boolean };
  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(ua, ub);
  }
  let diff = 0;
  for (let i = 0; i < ua.byteLength; i++) {
    diff |= (ua[i] ?? 0) ^ (ub[i] ?? 0);
  }
  return diff === 0;
}

/** Constant-time comparison of two strings (via their SHA-256 digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(a)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(b)),
  ]);
  return timingSafeEqualBytes(da, db);
}

export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return prefix + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function assetKey(appId: string, hash: string): string {
  return `apps/${appId}/assets/${hash}`;
}

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 501,
    message: string,
  ) {
    super(message);
  }
}

/** True when the request is over the limiter's budget for `key` (no limiter configured = never). */
export async function overLimit(
  limiter: { limit(o: { key: string }): Promise<{ success: boolean }> } | undefined,
  key: string,
): Promise<boolean> {
  if (!limiter) return false;
  return !(await limiter.limit({ key })).success;
}

export function clientIp(req: { header(name: string): string | undefined }): string {
  return req.header("cf-connecting-ip") ?? "unknown";
}
