// Airdrop's plans and monthly cost estimates for alternatives, from their public pricing pages (checked October 2026).
// Used by the landing page's static table and its interactive calculator.

export const PRICING_CHECKED = "October 2026";

/** Airdrop plans (monthly, by monthly active users). */
export const PLANS = [
  { id: "free", name: "Free", usd: 0, mau: 10_000, blurb: "For side projects and trying it out" },
  { id: "pro", name: "Pro", usd: 19, mau: 100_000, blurb: "For production apps" },
  { id: "scale", name: "Scale", usd: 79, mau: 1_000_000, blurb: "For apps at scale" },
  { id: "enterprise", name: "Enterprise", usd: null, mau: null, blurb: "Above 1M MAU, SLAs, invoicing" },
] as const;

export function airdropCost(mau: number): Estimate {
  for (const p of PLANS) if (p.mau !== null && mau <= p.mau) return { usd: p.usd, plan: p.name };
  return { usd: null, plan: "Enterprise", note: "talk to us" };
}

// EAS Update per-MAU overage tiers (Starter and Production share them above the included MAUs).
const EAS_TIERS: [number, number][] = [
  [200_000, 0.005],
  [500_000, 0.00375],
  [1_000_000, 0.0034],
  [2_000_000, 0.003],
  [3_000_000, 0.0024],
  [6_000_000, 0.0022],
  [10_000_000, 0.0016],
  [20_000_000, 0.0014],
  [Infinity, 0.00115],
];
function easOverage(mau: number, included: number) {
  let cost = 0;
  let from = included;
  for (const [upTo, price] of EAS_TIERS) {
    if (mau <= from) break;
    cost += (Math.min(mau, upTo) - from) * price;
    from = Math.max(from, upTo);
  }
  return cost;
}

/** Expo EAS Update: Free (1K MAU), Starter $19 (3K), Production $199 (50K), tiered overage. */
export function easCost(mau: number): Estimate {
  if (mau <= 1_000) return { usd: 0, plan: "Free" };
  const starter = 19 + easOverage(mau, 3_000);
  const production = 199 + easOverage(mau, 50_000);
  return starter <= production ? { usd: starter, plan: "Starter + usage" } : { usd: production, plan: "Production + usage" };
}

/** Revopush: Free 1K, $25 50K, $100 300K, $250 500K, $500 1M; $1 per 1,000 extra MAU. */
export function revopushCost(mau: number): Estimate {
  if (mau <= 1_000) return { usd: 0, plan: "Starter (free)" };
  const plans: [string, number, number][] = [
    ["Startup", 25, 50_000],
    ["Growing", 100, 300_000],
    ["Business", 250, 500_000],
    ["Professional", 500, 1_000_000],
  ];
  let best: Estimate = { usd: Infinity, plan: "" };
  for (const [plan, price, included] of plans) {
    const usd = price + Math.max(0, mau - included) / 1_000;
    if (usd < best.usd!) best = { usd, plan: mau > included ? `${plan} + overage` : plan };
  }
  return mau > 1_000_000 ? { ...best, note: "Enterprise pricing on request" } : best;
}

/** Stallion: Free 10K MAU, Pro $64/mo for 100K MAU; above that, usage pricing isn't published. */
export function stallionCost(mau: number): Estimate {
  if (mau <= 10_000) return { usd: 0, plan: "Free" };
  if (mau <= 100_000) return { usd: 64, plan: "Pro" };
  return { usd: null, plan: "Pro + usage / Enterprise", note: "Overage pricing not published" };
}

export const PROVIDERS = [
  { id: "airdrop", name: "Airdrop", cost: airdropCost, url: "#pricing" },
  { id: "eas", name: "Expo EAS Update", cost: easCost, url: "https://expo.dev/pricing" },
  { id: "revopush", name: "Revopush", cost: revopushCost, url: "https://revopush.org/#pricing" },
  { id: "stallion", name: "Stallion", cost: stallionCost, url: "https://stalliontech.io/pricing" },
] as const;

export function formatUsd(usd: number | null) {
  if (usd === null) return "not published";
  if (usd === 0) return "$0";
  return usd < 100 ? `$${usd.toFixed(usd < 10 ? 2 : 0)}` : `$${Math.round(usd).toLocaleString("en-US")}`;
}

export function formatMau(mau: number) {
  return mau >= 1e6 ? `${+(mau / 1e6).toFixed(1)}M` : `${Math.round(mau / 1e3)}K`;
}
