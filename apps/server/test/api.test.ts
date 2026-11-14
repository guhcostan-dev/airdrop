import { describe, expect, it } from "vitest";
import { env, exports } from "cloudflare:workers";
import { signingMessage } from "@rn-airdrop/core";

const ADMIN = { authorization: "Bearer test-admin-token" };
const BASE = "https://airdrop.test";

function call(path: string, init: RequestInit = {}) {
  return (exports as unknown as { default: Fetcher }).default.fetch(`${BASE}${path}`, init);
}
function json(path: string, method: string, body?: unknown, headers: Record<string, string> = ADMIN) {
  return call(path, {
    method,
    headers: { ...headers, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function sha256(data: Uint8Array) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function gzip(data: Uint8Array) {
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}

async function createApp(name = "Demo") {
  const res = await json("/v1/apps", "POST", { name });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
}

async function uploadFile(appId: string, content: string) {
  const bytes = new TextEncoder().encode(content);
  const hash = await sha256(bytes);
  const res = await call(`/v1/apps/${appId}/assets/${hash}`, { method: "PUT", headers: ADMIN, body: await gzip(bytes) });
  expect(res.status).toBe(201);
  return { hash, size: bytes.byteLength };
}

async function publish(appId: string, content: string, extra: Record<string, unknown> = {}) {
  const f = await uploadFile(appId, content);
  const id = crypto.randomUUID();
  const res = await json(`/v1/apps/${appId}/updates`, "POST", {
    id,
    channel: "production",
    platform: "android",
    runtimeVersion: "1.0.0",
    launchAsset: { path: "index.android.bundle", ...f },
    assets: [],
    ...extra,
  });
  expect(res.status).toBe(201);
  return id;
}

function check(appId: string, body: Record<string, unknown> = {}) {
  return json(
    "/v1/check",
    "POST",
    { appId, platform: "android", runtimeVersion: "1.0.0", deviceId: "device-0001", ...body },
    {},
  ).then((r) => r.json() as Promise<any>);
}

describe("auth", () => {
  it("rejects admin routes without a token", async () => {
    expect((await call("/v1/apps")).status).toBe(401);
    expect((await call("/v1/apps", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
  });

  it("issues API tokens that work and can be revoked", async () => {
    const res = await json("/v1/tokens", "POST", { name: "ci" });
    const { id, token } = (await res.json()) as { id: string; token: string };
    expect((await call("/v1/apps", { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
    expect((await json(`/v1/tokens/${id}`, "DELETE")).status).toBe(204);
    expect((await call("/v1/apps", { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
  });
});

describe("assets", () => {
  it("rejects uploads whose content does not match the hash", async () => {
    const app = await createApp();
    const res = await call(`/v1/apps/${app.id}/assets/${"0".repeat(64)}`, {
      method: "PUT",
      headers: ADMIN,
      body: await gzip(new TextEncoder().encode("hello")),
    });
    expect(res.status).toBe(422);
  });

  it("reports missing hashes and serves uploaded files gzip-encoded", async () => {
    const app = await createApp();
    const { hash } = await uploadFile(app.id, "console.log('hi')");
    const missing = await json(`/v1/apps/${app.id}/assets/missing`, "POST", { hashes: [hash, "f".repeat(64)] });
    expect(await missing.json()).toEqual({ missing: ["f".repeat(64)] });

    const res = await call(`/v1/assets/${app.id}/${hash}`);
    expect(res.status).toBe(200);
    // fetch() in tests decodes the gzip body just like devices do.
    expect(await res.text()).toBe("console.log('hi')");

    // Later requests are served from the cache and must not be compressed a second time.
    for (let i = 0; i < 3; i++) {
      const again = await call(`/v1/assets/${app.id}/${hash}`, { headers: { "accept-encoding": "gzip, br" } });
      expect(again.headers.get("content-encoding")).toBe("gzip");
      expect(await again.text()).toBe("console.log('hi')");
    }
  });
});

describe("publish + check", () => {
  it("refuses updates referencing files that were not uploaded", async () => {
    const app = await createApp();
    const res = await json(`/v1/apps/${app.id}/updates`, "POST", {
      id: crypto.randomUUID(),
      channel: "production",
      platform: "ios",
      runtimeVersion: "1.0.0",
      launchAsset: { path: "main.jsbundle", hash: "a".repeat(64), size: 1 },
      assets: [],
    });
    expect(res.status).toBe(409);
  });

  it("serves the newest update, then noUpdate once installed", async () => {
    const app = await createApp();
    expect((await check(app.id)).status).toBe("noUpdate");
    await publish(app.id, "v1");
    const v2 = await publish(app.id, "v2", { message: "second" });

    const r = await check(app.id);
    expect(r.status).toBe("update");
    expect(r.update.id).toBe(v2);
    expect(r.update.message).toBe("second");
    expect(r.update.launchAsset.url).toBe(`${BASE}/v1/assets/${app.id}/${r.update.launchAsset.hash}`);

    expect((await check(app.id, { currentUpdateId: v2 })).status).toBe("noUpdate");
    // Different runtime / platform / channel see nothing.
    expect((await check(app.id, { runtimeVersion: "2.0.0" })).status).toBe("noUpdate");
    expect((await check(app.id, { platform: "ios" })).status).toBe("noUpdate");
    expect((await check(app.id, { channel: "staging" })).status).toBe("noUpdate");
  });

  it("rolls devices back when an update is disabled", async () => {
    const app = await createApp();
    const v1 = await publish(app.id, "r1");
    const v2 = await publish(app.id, "r2");
    await json(`/v1/apps/${app.id}/updates/${v2}`, "PATCH", { enabled: false });

    const r = await check(app.id, { currentUpdateId: v2 });
    expect(r.status).toBe("update");
    expect(r.update.id).toBe(v1);

    await json(`/v1/apps/${app.id}/updates/${v1}`, "PATCH", { enabled: false });
    expect((await check(app.id, { currentUpdateId: v1 })).status).toBe("rollbackToEmbedded");
    expect((await check(app.id)).status).toBe("noUpdate");
  });

  it("respects staged rollouts deterministically", async () => {
    const app = await createApp();
    const id = await publish(app.id, "staged", { rolloutPercentage: 30 });
    let got = 0;
    for (let i = 0; i < 200; i++) {
      const r = await check(app.id, { deviceId: `device-${i.toString().padStart(6, "0")}` });
      if (r.status === "update") got++;
    }
    expect(got).toBeGreaterThan(30);
    expect(got).toBeLessThan(90);
    await json(`/v1/apps/${app.id}/updates/${id}`, "PATCH", { rolloutPercentage: 100 });
    expect((await check(app.id)).status).toBe("update");
  });

  it("propagates mandatory flags of skipped updates", async () => {
    const app = await createApp();
    const v1 = await publish(app.id, "m1");
    await publish(app.id, "m2", { mandatory: true });
    await publish(app.id, "m3");
    const r = await check(app.id, { currentUpdateId: v1 });
    expect(r.update.mandatory).toBe(true);
    expect((await check(app.id)).update.mandatory).toBe(false);
  });

  it("requires signatures when the app has a public key", async () => {
    const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const raw = new Uint8Array((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer);
    const app = await createApp();
    await json(`/v1/apps/${app.id}`, "PATCH", { signingPublicKey: btoa(String.fromCharCode(...raw)) });

    const f = await uploadFile(app.id, "signed");
    const body = {
      id: crypto.randomUUID(),
      channel: "production",
      platform: "ios" as const,
      runtimeVersion: "1.0.0",
      launchAsset: { path: "main.jsbundle", ...f },
      assets: [],
    };
    expect((await json(`/v1/apps/${app.id}/updates`, "POST", body)).status).toBe(400);
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keys.privateKey,
      new TextEncoder().encode(signingMessage(body)),
    );
    const res = await json(`/v1/apps/${app.id}/updates`, "POST", {
      ...body,
      signature: btoa(String.fromCharCode(...new Uint8Array(sig))),
    });
    expect(res.status).toBe(201);
  });

  it("promotes an update to another channel and records stats", async () => {
    const app = await createApp();
    const id = await publish(app.id, "promote-me");
    const res = await json(`/v1/apps/${app.id}/updates/${id}/promote`, "POST", { channel: "beta" });
    expect(res.status).toBe(201);
    const promoted = (await res.json()) as { id: string };
    expect((await check(app.id, { channel: "beta" })).update.id).toBe(promoted.id);

    const ev = await json(
      "/v1/events",
      "POST",
      { appId: app.id, deviceId: "device-0001", events: [{ type: "install", updateId: id }] },
      {},
    );
    expect(ev.status).toBe(202);
  });
});

describe("app-scoped tokens", () => {
  async function scopedToken(appId: string) {
    const res = await json("/v1/tokens", "POST", { name: "customer", appId });
    expect(res.status).toBe(201);
    return { authorization: `Bearer ${((await res.json()) as { token: string }).token}` };
  }

  it("only sees and manages its own app", async () => {
    const mine = await createApp("Mine");
    const other = await createApp("Other");
    const auth = await scopedToken(mine.id);

    const list = (await (await json("/v1/apps", "GET", undefined, auth)).json()) as { apps: { id: string }[] };
    expect(list.apps.map((a) => a.id)).toEqual([mine.id]);

    expect((await json(`/v1/apps/${mine.id}`, "GET", undefined, auth)).status).toBe(200);
    expect((await json(`/v1/apps/${mine.id}/updates`, "GET", undefined, auth)).status).toBe(200);
    // Other apps look like they don't exist, for every route under /v1/apps/:appId.
    for (const [path, method] of [
      [`/v1/apps/${other.id}`, "GET"],
      [`/v1/apps/${other.id}`, "PATCH"],
      [`/v1/apps/${other.id}/updates`, "GET"],
      [`/v1/apps/${other.id}/assets/missing`, "POST"],
    ] as const) {
      const res = await json(path, method, method === "GET" ? undefined : {}, auth);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const put = await call(`/v1/apps/${other.id}/assets/${"0".repeat(64)}`, { method: "PUT", headers: auth, body: "x" });
    expect(put.status).toBe(404);
  });

  it("can't create apps, change plans, manage tokens or read the waitlist", async () => {
    const mine = await createApp("Mine");
    const auth = await scopedToken(mine.id);
    expect((await json("/v1/apps", "POST", { name: "Sneaky" }, auth)).status).toBe(403);
    expect((await json(`/v1/apps/${mine.id}`, "PATCH", { plan: "scale" }, auth)).status).toBe(403);
    expect((await json("/v1/tokens", "GET", undefined, auth)).status).toBe(403);
    expect((await json("/v1/tokens", "POST", { name: "escalate" }, auth)).status).toBe(403);
    expect((await json("/v1/waitlist", "GET", undefined, auth)).status).toBe(403);
  });

  it("rejects tokens scoped to an unknown app", async () => {
    expect((await json("/v1/tokens", "POST", { name: "x", appId: crypto.randomUUID() })).status).toBe(404);
  });
});

describe("waitlist", () => {
  const post = (body: unknown, origin = "https://site.test") =>
    call("/v1/waitlist", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });

  it("stores signups once and lets operators read them", async () => {
    const email = `dev-${crypto.randomUUID()}@example.com`;
    const res = await post({ email, app: "Shop", mau: "10k-100k" });
    expect(res.status).toBe(202);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://site.test");
    expect((await post({ email: email.toUpperCase() })).status).toBe(202); // duplicate: same answer
    const list = (await (await json("/v1/waitlist", "GET")).json()) as { entries: { email: string; mau: string }[] };
    const mine = list.entries.filter((e) => e.email === email);
    expect(mine).toEqual([expect.objectContaining({ email, mau: "10k-100k" })]);
  });

  it("validates input, ignores the honeypot and only allows the website's origin", async () => {
    expect((await post({ email: "not-an-email" })).status).toBe(400);
    const bot = `bot-${crypto.randomUUID()}@example.com`;
    expect((await post({ email: bot, company: "Spam Inc" })).status).toBe(202);
    const list = (await (await json("/v1/waitlist", "GET")).json()) as { entries: { email: string }[] };
    expect(list.entries.some((e) => e.email === bot)).toBe(false);
    const foreign = await post({ email: `x-${crypto.randomUUID()}@example.com` }, "https://evil.test");
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("requires a token to read the list", async () => {
    expect((await call("/v1/waitlist")).status).toBe(401);
  });
});

describe("customer data deletion", () => {
  it("lets a customer delete their own app, which also revokes their token", async () => {
    const mine = await createApp("Mine");
    const res = await json("/v1/tokens", "POST", { name: "customer", appId: mine.id });
    const auth = { authorization: `Bearer ${((await res.json()) as { token: string }).token}` };
    await uploadFile(mine.id, "bye");
    expect((await json(`/v1/apps/${mine.id}`, "DELETE", undefined, auth)).status).toBe(204);
    expect((await json(`/v1/apps/${mine.id}`, "GET")).status).toBe(404);
    expect((await json("/v1/apps", "GET", undefined, auth)).status).toBe(401);
  });
});

describe("plans and usage", () => {
  async function devices(appId: string, n: number) {
    for (let i = 0; i < n; i++) await check(appId, { deviceId: `device-${appId.slice(0, 8)}-${i}` });
  }
  const usage = async (appId: string) =>
    (await (await json(`/v1/apps/${appId}/usage`, "GET")).json()) as {
      plan: string;
      activeDevices: number;
      activeDevicesLimit: number | null;
      storageBytes: number;
      overLimit: boolean;
    };

  it("counts each device once per month and reports the plan", async () => {
    const app = await createApp();
    await devices(app.id, 3);
    await devices(app.id, 3); // same devices again
    const u = await usage(app.id);
    expect(u).toMatchObject({ plan: "free", activeDevices: 3, activeDevicesLimit: 10_000, overLimit: false });
  });

  it("tracks stored bytes per app", async () => {
    const app = await createApp();
    await uploadFile(app.id, "a".repeat(1000));
    await uploadFile(app.id, "b".repeat(1000));
    expect((await usage(app.id)).storageBytes).toBeGreaterThan(0);
  });

  it("lets operators change plans and validates them", async () => {
    const app = await createApp();
    expect((await json(`/v1/apps/${app.id}`, "PATCH", { plan: "gold" })).status).toBe(400);
    const res = await json(`/v1/apps/${app.id}`, "PATCH", { plan: "pro" });
    expect(((await res.json()) as { plan: string }).plan).toBe("pro");
    expect((await usage(app.id)).activeDevicesLimit).toBe(100_000);
  });

  it("blocks new releases (not devices) over the plan's monthly active devices", async () => {
    const app = await createApp();
    // Simulate a month with more devices than the free plan allows (+10% grace).
    const month = new Date().toISOString().slice(0, 7);
    const rows = Array.from({ length: 11_001 }, (_, i) => `('${app.id}', '${month}', 'd${i}')`);
    for (let i = 0; i < rows.length; i += 500)
      await env.DB.exec(`INSERT INTO active_devices (app_id, month, device) VALUES ${rows.slice(i, i + 500).join(",")}`);
    expect((await usage(app.id)).overLimit).toBe(true);
    const { hash, size } = await uploadFile(app.id, "console.log('v2')");
    const res = await json(`/v1/apps/${app.id}/updates`, "POST", {
      id: crypto.randomUUID(),
      channel: "production",
      platform: "ios",
      runtimeVersion: "1.0.0",
      launchAsset: { path: "main.jsbundle", hash, size },
      assets: [],
    });
    expect(res.status).toBe(402);
    // Existing devices still get answers.
    expect((await check(app.id, { platform: "ios" })).status).toBe("noUpdate");
  });
});

describe("maintenance", () => {
  it("deletes old unpublished files, keeps published ones, prunes old metering", async () => {
    const { runMaintenance } = await import("../src/maintenance");
    const app = await createApp();
    const used = await uploadFile(app.id, "console.log('published')");
    const orphan = await uploadFile(app.id, "console.log('never published')");
    const publish = await json(`/v1/apps/${app.id}/updates`, "POST", {
      id: crypto.randomUUID(),
      channel: "production",
      platform: "android",
      runtimeVersion: "1.0.0",
      launchAsset: { path: "index.android.bundle", hash: used.hash, size: used.size },
      assets: [],
    });
    expect(publish.status).toBe(201);
    // Nothing is old enough yet.
    expect((await runMaintenance(env)).deletedOrphans).toBe(0);
    await env.DB.prepare("INSERT INTO active_devices (app_id, month, device) VALUES (?, '2001-01', 'old')").bind(app.id).run();
    const later = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    const report = await runMaintenance(env, later);
    expect(report.deletedOrphans).toBeGreaterThanOrEqual(1);
    expect(report.prunedDeviceRows).toBeGreaterThanOrEqual(1);
    expect((await call(`/v1/assets/${app.id}/${orphan.hash}`)).status).toBe(404);
    expect((await call(`/v1/assets/${app.id}/${used.hash}`)).status).toBe(200);
  });
});

describe("rate limits", () => {
  it("throttles repeated failed token attempts", async () => {
    const statuses = [];
    for (let i = 0; i < 25; i++) statuses.push((await call("/v1/apps", { headers: { authorization: "Bearer nope" } })).status);
    expect(statuses).toContain(429);
  });
});

describe("dashboard CORS", () => {
  it("allows the website to call management routes with a token, and nobody else", async () => {
    const pre = await call("/v1/apps", {
      method: "OPTIONS",
      headers: { origin: "https://site.test", "access-control-request-method": "GET", "access-control-request-headers": "authorization" },
    });
    expect(pre.headers.get("access-control-allow-origin")).toBe("https://site.test");
    expect(pre.headers.get("access-control-allow-headers")).toContain("authorization");
    const ok = await call("/v1/apps", { headers: { ...ADMIN, origin: "https://site.test" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://site.test");
    const evil = await call("/v1/apps", { headers: { ...ADMIN, origin: "https://evil.test" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("billing", () => {
  async function signed(payload: string, secret = "whsec_test", t = Math.floor(Date.now() / 1000)) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
    return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  const hook = async (event: unknown, sig?: string) => {
    const payload = JSON.stringify(event);
    return call("/v1/billing/webhook", { method: "POST", headers: { "stripe-signature": sig ?? (await signed(payload)) }, body: payload });
  };
  const planOf = async (id: string) => ((await (await json(`/v1/apps/${id}`, "GET")).json()) as { plan: string }).plan;

  it("is disabled until Stripe is configured", async () => {
    const app = await createApp();
    expect(((await (await call("/v1/billing/config")).json()) as { enabled: boolean }).enabled).toBe(false);
    expect((await json(`/v1/apps/${app.id}/billing/checkout`, "POST", { plan: "pro" })).status).toBe(501);
  });

  it("upgrades on a verified checkout and downgrades when the subscription ends", async () => {
    const app = await createApp();
    const sub = `sub_${crypto.randomUUID()}`;
    const done = await hook({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: app.id, metadata: { app_id: app.id, plan: "pro" }, customer: "cus_1", subscription: sub } },
    });
    expect(done.status).toBe(200);
    expect(await planOf(app.id)).toBe("pro");
    await hook({ type: "customer.subscription.updated", data: { object: { id: sub, status: "unpaid", metadata: { plan: "pro" } } } });
    expect(await planOf(app.id)).toBe("free");
    await hook({ type: "customer.subscription.updated", data: { object: { id: sub, status: "active", metadata: { plan: "scale" } } } });
    expect(await planOf(app.id)).toBe("scale");
    await hook({ type: "customer.subscription.deleted", data: { object: { id: sub, status: "canceled" } } });
    expect(await planOf(app.id)).toBe("free");
  });

  it("rejects forged, stale or wrongly signed webhooks", async () => {
    const app = await createApp();
    const event = { type: "checkout.session.completed", data: { object: { metadata: { app_id: app.id, plan: "scale" } } } };
    const payload = JSON.stringify(event);
    expect((await hook(event, await signed(payload, "whsec_wrong"))).status).toBe(400);
    expect((await hook(event, await signed(payload, "whsec_test", Math.floor(Date.now() / 1000) - 3600))).status).toBe(400);
    expect((await hook(event, "t=1,v1=deadbeef")).status).toBe(400);
    expect(await planOf(app.id)).toBe("free");
  });
});
