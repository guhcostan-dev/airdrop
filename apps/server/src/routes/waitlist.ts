import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "../env";
import { clientIp, HttpError, now, overLimit } from "../util";

/** Public early-access form on the website. Operators read it with GET /v1/waitlist (admin.ts). */
export const waitlist = new Hono<AppEnv>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAU_BUCKETS = new Set(["<10k", "10k-100k", "100k-1m", ">1m"]);

waitlist.use(
  "/v1/waitlist",
  cors({
    origin: (origin, c) => {
      const allowed = (c.env.WEB_ORIGINS ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["POST"],
    allowHeaders: ["content-type"],
    maxAge: 86400,
  }),
);

waitlist.post("/v1/waitlist", async (c) => {
  const body = await c.req
    .json<{ email?: unknown; app?: unknown; mau?: unknown; company?: unknown }>()
    .catch(() => ({}) as never);
  if (await overLimit(c.env.RL_WAITLIST, clientIp(c.req))) throw new HttpError(429, "too many requests");
  // "company" is a hidden honeypot field: bots fill it, people don't. Pretend success.
  if (typeof body.company === "string" && body.company !== "") return c.body(null, 202);
  if (typeof body.email !== "string" || body.email.length > 254 || !EMAIL_RE.test(body.email.trim()))
    throw new HttpError(400, "a valid email is required");
  const app = typeof body.app === "string" ? body.app.trim().slice(0, 100) || null : null;
  const mau = typeof body.mau === "string" && MAU_BUCKETS.has(body.mau) ? body.mau : null;
  // Same response whether or not the email was already on the list.
  await c.env.DB.prepare(
    "INSERT INTO waitlist (id, email, app_name, mau, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING",
  )
    .bind(crypto.randomUUID(), body.email.trim().toLowerCase(), app, mau, now())
    .run();
  return c.body(null, 202);
});
