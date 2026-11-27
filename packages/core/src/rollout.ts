/**
 * Deterministic 0..99 bucket for a (device, update) pair. Including the update
 * id means each rollout samples a different slice of the fleet, so the same
 * unlucky devices are not always first.
 */
export async function rolloutBucket(deviceId: string, updateId: string): Promise<number> {
  const data = new TextEncoder().encode(`${deviceId}:${updateId}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const n = ((digest[0]! << 24) | (digest[1]! << 16) | (digest[2]! << 8) | digest[3]!) >>> 0;
  return n % 100;
}

export async function isInRollout(deviceId: string, updateId: string, percentage: number): Promise<boolean> {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  return (await rolloutBucket(deviceId, updateId)) < percentage;
}
