import { beforeEach, describe, expect, it, vi } from "vitest";

function makeNative(overrides: Record<string, unknown> = {}) {
  const state = {
    deviceId: "device-123456",
    currentUpdateId: null as string | null,
    pendingUpdateId: null as string | null,
    rollbackToEmbeddedPending: false,
    failedUpdateIds: [] as string[],
  };
  return {
    state,
    platform: "android",
    sdkVersion: "0.1.0",
    enabled: true,
    runtimeVersion: "1.0",
    serverUrl: "https://ota.example.com/",
    appId: "00000000-0000-4000-8000-000000000001",
    channel: "production",
    getState: vi.fn(async () => ({ ...state })),
    downloadUpdate: vi.fn(async (m: { id: string }) => {
      state.pendingUpdateId = m.id;
      return m.id;
    }),
    notifyAppReady: vi.fn(async () => ({ installedUpdateId: null, rolledBackUpdateIds: [] as string[] })),
    clearUpdates: vi.fn(async () => {}),
    restartApp: vi.fn(),
    ...overrides,
  };
}

const update = (id: string, mandatory = false) => ({
  id,
  createdAt: "",
  channel: "production",
  platform: "android",
  runtimeVersion: "1.0",
  message: null,
  mandatory,
  launchAsset: { path: "index.android.bundle", hash: "a".repeat(64), size: 1, url: "https://x" },
  assets: [],
  signature: null,
});

function mockServer(response: unknown) {
  const calls: { url: string; body: any }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const body = url.endsWith("/v1/check") ? response : null;
    return new Response(body ? JSON.stringify(body) : null, { status: body ? 200 : 202 });
  }) as never;
  return calls;
}

let AppState: any;
async function load(native: unknown) {
  vi.resetModules();
  const rn: any = await import("react-native");
  rn.NativeModules.RNAirdrop = native;
  AppState = rn.AppState;
  return import("../src");
}

describe("sync", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends device info, downloads and waits for next restart by default", async () => {
    const native = makeNative();
    const calls = mockServer({ status: "update", update: update("u1") });
    const { sync } = await load(native);
    const statuses: string[] = [];
    const r = await sync({ onStatusChange: (s) => statuses.push(s) });
    expect(r.status).toBe("installed");
    expect(statuses).toEqual(["checking", "downloading", "installed"]);
    expect(calls[0]!.url).toBe("https://ota.example.com/v1/check");
    expect(calls[0]!.body).toMatchObject({ platform: "android", runtimeVersion: "1.0", deviceId: "device-123456" });
    expect(native.downloadUpdate).toHaveBeenCalledOnce();
    expect(native.restartApp).not.toHaveBeenCalled();
  });

  it("restarts immediately for mandatory updates", async () => {
    const native = makeNative();
    mockServer({ status: "update", update: update("u2", true) });
    const { sync } = await load(native);
    await sync();
    expect(native.restartApp).toHaveBeenCalledOnce();
  });

  it("applies nextResume updates after returning from background", async () => {
    const native = makeNative();
    mockServer({ status: "update", update: update("u3") });
    const { sync } = await load(native);
    await sync({ installMode: "nextResume" });
    expect(native.restartApp).not.toHaveBeenCalled();
    AppState.emit("background");
    AppState.emit("active");
    expect(native.restartApp).toHaveBeenCalledOnce();
  });

  it("ignores updates that previously failed on this device", async () => {
    const native = makeNative();
    native.state.failedUpdateIds = ["bad"];
    mockServer({ status: "update", update: update("bad") });
    const { sync } = await load(native);
    expect((await sync()).status).toBe("upToDate");
    expect(native.downloadUpdate).not.toHaveBeenCalled();
  });

  it("reports an already staged update as installed without downloading again", async () => {
    const native = makeNative();
    native.state.pendingUpdateId = "u5";
    mockServer({ status: "update", update: update("u5") });
    const { sync } = await load(native);
    expect((await sync()).status).toBe("installed");
  });

  it("clears to embedded when the server says so", async () => {
    const native = makeNative();
    native.state.currentUpdateId = "u9";
    mockServer({ status: "rollbackToEmbedded" });
    const { sync } = await load(native);
    expect((await sync()).status).toBe("rolledBackToEmbedded");
    expect(native.clearUpdates).toHaveBeenCalledOnce();
  });

  it("is a no-op when disabled (debug builds)", async () => {
    const native = makeNative({ enabled: false });
    const calls = mockServer({ status: "noUpdate" });
    const { sync } = await load(native);
    expect((await sync()).status).toBe("disabled");
    expect(calls).toHaveLength(0);
  });

  it("reports installs and rollbacks after notifyAppReady", async () => {
    const native = makeNative({
      notifyAppReady: vi.fn(async () => ({ installedUpdateId: "new", rolledBackUpdateIds: ["old"] })),
    });
    const calls = mockServer({ status: "noUpdate" });
    const { notifyAppReady } = await load(native);
    await notifyAppReady();
    await new Promise<void>((r) => setTimeout(r, 10));
    const ev = calls.find((c) => c.url.endsWith("/v1/events"));
    expect(ev?.body.events).toEqual([
      { type: "rollback", updateId: "old" },
      { type: "install", updateId: "new" },
    ]);
  });
});
