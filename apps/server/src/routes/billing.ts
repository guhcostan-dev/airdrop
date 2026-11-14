import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireAppAccess, requireToken } from "../auth";
import type { AppEnv, Env } from "../env";
import { isPlan, type PlanId } from "../plans";
import { HttpError, timingSafeEqualBytes, toHex } from "../util";

/**
 * Stripe billing. Disabled (501) until STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the price ids
 * are configured. Plans change only from verified webhooks, never from the browser.
 */
export const billing = new Hono<AppEnv>();

const PAID: Exclude<PlanId, "free" | "enterprise">[] = ["pro", "scale"];

function priceFor(env: Env, plan: string): string | undefined {
  return plan === "pro" ? env.STRIPE_PRICE_PRO : plan === "scale" ? env.STRIPE_PRICE_SCALE : undefined;
}

function enabled(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_SCALE);
}

async function stripe<T>(env: Env, path: string, form: Record<string, string>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("stripe error", path, data.error?.message);
    throw new HttpError(500, "billing provider error");
  }
  return data;
}

const siteCors = cors({
  origin: (origin, c) => ((c.env.WEB_ORIGINS ?? "").split(",").map((s: string) => s.trim()).includes(origin) ? origin : null),
  allowMethods: ["GET", "POST"],
  allowHeaders: ["authorization", "content-type"],
  maxAge: 86400,
});
billing.use("/v1/billing/config", siteCors);
billing.use("/v1/apps/:appId/billing/*", siteCors);
billing.use("/v1/apps/:appId/billing/*", requireToken, requireAppAccess);

billing.get("/v1/billing/config", (c) => c.json({ enabled: enabled(c.env), plans: PAID }));

billing.post("/v1/apps/:appId/billing/checkout", async (c) => {
  if (!enabled(c.env)) throw new HttpError(501, "billing is not enabled yet");
  const appId = c.req.param("appId");
  const body = await c.req.json<{ plan?: unknown }>().catch(() => ({}) as never);
  const plan = String(body.plan);
  const price = priceFor(c.env, plan);
  if (!price) throw new HttpError(400, `plan must be one of: ${PAID.join(", ")}`);
  const app = await c.env.DB.prepare("SELECT id, name, stripe_customer_id FROM apps WHERE id = ?")
    .bind(appId)
    .first<{ id: string; name: string; stripe_customer_id: string | null }>();
  if (!app) throw new HttpError(404, "app not found");
  const site = c.env.SITE_URL ?? "https://airdrop.guhcostan.dev";
  const session = await stripe<{ url: string }>(c.env, "checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    client_reference_id: app.id,
    "metadata[app_id]": app.id,
    "metadata[plan]": plan,
    "subscription_data[metadata][app_id]": app.id,
    "subscription_data[metadata][plan]": plan,
    success_url: `${site}/dashboard/?billing=success`,
    cancel_url: `${site}/dashboard/?billing=cancelled`,
    ...(app.stripe_customer_id ? { customer: app.stripe_customer_id } : {}),
  });
  return c.json({ url: session.url });
});

billing.post("/v1/apps/:appId/billing/portal", async (c) => {
  if (!enabled(c.env)) throw new HttpError(501, "billing is not enabled yet");
  const app = await c.env.DB.prepare("SELECT stripe_customer_id FROM apps WHERE id = ?")
    .bind(c.req.param("appId"))
    .first<{ stripe_customer_id: string | null }>();
  if (!app?.stripe_customer_id) throw new HttpError(404, "no billing account for this app yet");
  const site = c.env.SITE_URL ?? "https://airdrop.guhcostan.dev";
  const session = await stripe<{ url: string }>(c.env, "billing_portal/sessions", {
    customer: app.stripe_customer_id,
    return_url: `${site}/dashboard/`,
  });
  return c.json({ url: session.url });
});

/** Verifies a `Stripe-Signature` header (v1 scheme, 5-minute tolerance). */
export async function verifyStripeSignature(payload: string, header: string, secret: string, nowSec = Date.now() / 1000) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const signatures = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length || Math.abs(nowSec - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`))));
  return signatures.some((s) => s.length === mac.length && timingSafeEqualBytes(new TextEncoder().encode(s), new TextEncoder().encode(mac)));
}

billing.post("/v1/billing/webhook", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) throw new HttpError(501, "billing is not enabled yet");
  const payload = await c.req.text();
  const ok = await verifyStripeSignature(payload, c.req.header("stripe-signature") ?? "", c.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) throw new HttpError(400, "invalid signature");
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, any> } };
  const obj = event.data.object;
  const db = c.env.DB;

  if (event.type === "checkout.session.completed") {
    const appId = obj.metadata?.app_id ?? obj.client_reference_id;
    const plan = obj.metadata?.plan;
    if (appId && isPlan(plan)) {
      await db
        .prepare("UPDATE apps SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?")
        .bind(plan, obj.customer ?? null, obj.subscription ?? null, appId)
        .run();
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(obj.status);
    const plan = active && isPlan(obj.metadata?.plan) ? obj.metadata.plan : "free";
    await db.prepare("UPDATE apps SET plan = ? WHERE stripe_subscription_id = ?").bind(plan, obj.id).run();
  }
  return c.json({ received: true });
});
