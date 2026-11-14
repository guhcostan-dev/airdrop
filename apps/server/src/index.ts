import { Hono } from "hono";
import { PROTOCOL_VERSION } from "@rn-airdrop/core";
import type { AppEnv } from "./env";
import { admin } from "./routes/admin";
import { billing } from "./routes/billing";
import { client } from "./routes/client";
import { waitlist } from "./routes/waitlist";
import { runMaintenance } from "./maintenance";
import type { Env } from "./env";
import { HttpError } from "./util";

const app = new Hono<AppEnv>();

app.get("/", (c) => c.json({ name: "react-native-airdrop", protocol: PROTOCOL_VERSION }));
app.get("/health", (c) => c.json({ ok: true }));

app.route("/", client);
app.route("/", waitlist);
app.route("/", billing);
app.route("/", admin);

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

async function proxyToAwsOrigin(req: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
  if (!env.AWS_ORIGIN) return null;
  const incomingUrl = new URL(req.url);
  const isAssetGet =
    (req.method === "GET" || req.method === "HEAD") &&
    /^\/v1\/assets\/[^/]+\/[0-9a-f]{64}$/.test(incomingUrl.pathname);
  const edgeCache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;

  if (isAssetGet && edgeCache) {
    const cached = await edgeCache.match(req);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: cached.headers,
        encodeBody: "manual",
      } as ResponseInit);
    }
  }

  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, env.AWS_ORIGIN);
  const headers = new Headers(req.headers);
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));
  headers.set("x-cloudflare-proxy", "1");
  headers.delete("host");
  headers.delete("accept-encoding");

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method: req.method,
    headers,
    body,
  });

  const outHeaders = new Headers(upstreamRes.headers);
  if (outHeaders.get("x-airdrop-gzip") === "1") {
    outHeaders.delete("x-airdrop-gzip");
    outHeaders.set("content-encoding", "gzip");
  }
  outHeaders.set("x-edge-proxy", "cloudflare-to-aws");

  const outBytes = await upstreamRes.arrayBuffer();
  const res = new Response(outBytes, {
    status: upstreamRes.status,
    headers: outHeaders,
    encodeBody: "manual",
  } as ResponseInit);

  if (isAssetGet && upstreamRes.status === 200 && edgeCache) {
    ctx.waitUntil(edgeCache.put(req, res.clone()));
  }
  return res;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (env.AWS_ORIGIN && req.headers.get("x-cloudflare-proxy") !== "1") {
      try {
        const proxied = await proxyToAwsOrigin(req, env, ctx);
        if (proxied) return proxied;
      } catch (err) {
        console.error("AWS origin proxy fallback to edge D1/R2:", err);
      }
    }
    return app.fetch(req, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMaintenance(env).then((r) => console.log("maintenance", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;
