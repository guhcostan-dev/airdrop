import { describe, expect, it } from "vitest";
import type { Api } from "../src/api";
import { handleMcpMessage, TOOLS } from "../src/mcp";

function fakeApi() {
  const calls: unknown[][] = [];
  const api = {
    listApps: async () => [{ id: "app-1", name: "Shop" }],
    listUpdates: async (...a: unknown[]) => (calls.push(["listUpdates", ...a]), [{ id: "u1" }]),
    patchUpdate: async (...a: unknown[]) => (calls.push(["patchUpdate", ...a]), { id: a[1], enabled: true }),
    promoteUpdate: async (...a: unknown[]) => (calls.push(["promoteUpdate", ...a]), { id: "u2" }),
    usage: async (...a: unknown[]) => (calls.push(["usage", ...a]), { activeDevices: 3 }),
  } as unknown as Api;
  return { api, calls };
}

const opts = (api: Api, appId?: string) => ({ api: () => api, defaultAppId: () => appId, version: "9.9.9" });
const rpc = (id: number, method: string, params?: Record<string, unknown>) => ({ jsonrpc: "2.0", id, method, params });

describe("mcp server", () => {
  it("initializes, negotiates the protocol and ignores notifications", async () => {
    const { api } = fakeApi();
    const init = (await handleMcpMessage(rpc(1, "initialize", { protocolVersion: "2025-03-26" }), opts(api))) as any;
    expect(init.result.protocolVersion).toBe("2025-03-26");
    expect(init.result.capabilities.tools).toBeDefined();
    expect(init.result.serverInfo).toEqual({ name: "airdrop", version: "9.9.9" });
    const future = (await handleMcpMessage(rpc(2, "initialize", { protocolVersion: "2099-01-01" }), opts(api))) as any;
    expect(future.result.protocolVersion).toBe("2025-06-18");
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, opts(api))).toBeNull();
    expect(((await handleMcpMessage(rpc(3, "nope"), opts(api))) as any).error.code).toBe(-32601);
  });

  it("lists the release tools with JSON schemas", async () => {
    const { api } = fakeApi();
    const res = (await handleMcpMessage(rpc(1, "tools/list"), opts(api))) as any;
    expect(res.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "apps", "updates", "rollout", "rollback", "resume", "promote", "usage",
    ]);
    for (const t of res.result.tools) expect(t.inputSchema.type).toBe("object");
    expect(TOOLS).toHaveLength(7);
  });

  it("calls the API with the default app or an explicit one", async () => {
    const { api, calls } = fakeApi();
    const call = (name: string, args: Record<string, unknown>) =>
      handleMcpMessage(rpc(1, "tools/call", { name, arguments: args }), opts(api, "app-1")) as Promise<any>;
    const listed = await call("updates", { channel: "production", limit: 5 });
    expect(listed.result.isError).toBe(false);
    expect(JSON.parse(listed.result.content[0].text)).toEqual([{ id: "u1" }]);
    await call("rollout", { updateId: "u1", percent: 25 });
    await call("rollback", { updateId: "u1", appId: "app-2" });
    await call("resume", { updateId: "u1" });
    await call("promote", { updateId: "u1", channel: "production", rolloutPercentage: 10 });
    await call("usage", {});
    expect(calls).toEqual([
      ["listUpdates", "app-1", { channel: "production", platform: undefined, limit: "5" }],
      ["patchUpdate", "app-1", "u1", { rolloutPercentage: 25 }],
      ["patchUpdate", "app-2", "u1", { enabled: false }],
      ["patchUpdate", "app-1", "u1", { enabled: true }],
      ["promoteUpdate", "app-1", "u1", { channel: "production", rolloutPercentage: 10 }],
      ["usage", "app-1"],
    ]);
  });

  it("reports bad arguments and server errors as tool errors", async () => {
    const { api } = fakeApi();
    const bad = (await handleMcpMessage(rpc(1, "tools/call", { name: "rollout", arguments: { updateId: "u1", percent: 0 } }), opts(api, "a"))) as any;
    expect(bad.result.isError).toBe(true);
    expect(bad.result.content[0].text).toContain("between 1 and 100");
    const noApp = (await handleMcpMessage(rpc(2, "tools/call", { name: "usage", arguments: {} }), opts(api))) as any;
    expect(noApp.result.content[0].text).toContain("no app selected");
    const failing = { ...api, usage: async () => { throw Object.assign(new Error("app not found"), { status: 404 }); } } as unknown as Api;
    const err = (await handleMcpMessage(rpc(3, "tools/call", { name: "usage", arguments: { appId: "x" } }), opts(failing))) as any;
    expect(err.result.content[0].text).toBe("Server error (404): app not found");
    expect(((await handleMcpMessage(rpc(4, "tools/call", { name: "deploy" }), opts(api))) as any).error.code).toBe(-32602);
  });
});
