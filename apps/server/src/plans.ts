/** Plan limits. Prices live on the website (apps/web/src/utils/pricing.ts); keep the two in sync. */
export const PLANS = {
  free: { mau: 10_000, storageBytes: 1 * 1024 ** 3 },
  pro: { mau: 100_000, storageBytes: 10 * 1024 ** 3 },
  scale: { mau: 1_000_000, storageBytes: 50 * 1024 ** 3 },
  enterprise: { mau: null, storageBytes: null },
} as const satisfies Record<string, { mau: number | null; storageBytes: number | null }>;

export type PlanId = keyof typeof PLANS;

export function isPlan(v: unknown): v is PlanId {
  return typeof v === "string" && Object.hasOwn(PLANS, v);
}

/** New releases are blocked once monthly active devices pass the plan limit by this factor. */
export const MAU_GRACE = 1.1;
