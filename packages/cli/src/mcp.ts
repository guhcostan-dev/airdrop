import readline from "node:readline";
import type { Api } from "./api";

/**
 * `airdrop mcp`: a Model Context Protocol server over stdio (newline-delimited JSON-RPC 2.0),
 * written by hand so the CLI keeps zero runtime dependencies. It exposes the release operations
 * of the CLI as tools, using the same credentials (`airdrop login` or AIRDROP_TOKEN).
 * stdout carries protocol messages only; diagnostics go to stderr.
 */

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Json = Record<string, unknown>;
interface Tool {
  name: string;
  description: string;
  inputSchema: Json;
  run(api: Api, args: Json, appId: () => string): Promise<unknown>;
}

const appIdProp = {
  appId: { type: "string", description: "App id. Defaults to the app in airdrop.config.json / AIRDROP_APP_ID." },
};
const updateIdProp = { updateId: { type: "string", description: "Update id (from the `updates` tool)." } };

function str(args: Json, key: string, required = false): string | undefined {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new Error(`${key} must be a string`);
  return v;
}

function percent(args: Json, key: string, required = false): number | undefined {
  const v = args[key];
  if (v === undefined || v === null) {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  const n = typeof v === "string" ? Number(v.replace(/%$/, "")) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 100)
    throw new Error(`${key} must be an integer between 1 and 100`);
  return n;
}

function pickApp(args: Json, appId: () => string) {
  return str(args, "appId") ?? appId();
}

export const TOOLS: Tool[] = [
  {
    name: "apps",
    description: "List the Airdrop apps these credentials can access (id, name, plan, signing).",
    inputSchema: { type: "object", properties: {} },
    run: (api) => api.listApps(),
  },
  {
    name: "updates",
    description:
      "List recent OTA updates of an app, newest first, with rollout percentage, enabled state and install/rollback/error counts.",
    inputSchema: {
      type: "object",
      properties: {
        ...appIdProp,
        channel: { type: "string", description: "Filter by channel, e.g. production." },
        platform: { type: "string", enum: ["ios", "android"] },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    run: (api, args, appId) =>
      api.listUpdates(pickApp(args, appId), {
        channel: str(args, "channel"),
        platform: str(args, "platform"),
        limit: args.limit === undefined ? undefined : String(args.limit),
      }),
  },
  {
    name: "rollout",
    description: "Change the staged rollout percentage of an update (1-100).",
    inputSchema: {
      type: "object",
      properties: { ...appIdProp, ...updateIdProp, percent: { type: "integer", minimum: 1, maximum: 100 } },
      required: ["updateId", "percent"],
    },
    run: (api, args, appId) =>
      api.patchUpdate(pickApp(args, appId), str(args, "updateId", true)!, { rolloutPercentage: percent(args, "percent", true) }),
  },
  {
    name: "rollback",
    description:
      "Disable an update. Devices on it fall back to the previous update (or the store build) on their next check.",
    inputSchema: { type: "object", properties: { ...appIdProp, ...updateIdProp }, required: ["updateId"] },
    run: (api, args, appId) => api.patchUpdate(pickApp(args, appId), str(args, "updateId", true)!, { enabled: false }),
  },
  {
    name: "resume",
    description: "Re-enable an update that was rolled back.",
    inputSchema: { type: "object", properties: { ...appIdProp, ...updateIdProp }, required: ["updateId"] },
    run: (api, args, appId) => api.patchUpdate(pickApp(args, appId), str(args, "updateId", true)!, { enabled: true }),
  },
  {
    name: "promote",
    description: "Copy an update to another channel (e.g. staging -> production) without rebuilding it.",
    inputSchema: {
      type: "object",
      properties: {
        ...appIdProp,
        ...updateIdProp,
        channel: { type: "string", description: "Target channel." },
        rolloutPercentage: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["updateId", "channel"],
    },
    run: (api, args, appId) =>
      api.promoteUpdate(pickApp(args, appId), str(args, "updateId", true)!, {
        channel: str(args, "channel", true)!,
        rolloutPercentage: percent(args, "rolloutPercentage"),
      }),
  },
  {
    name: "usage",
    description: "Monthly active devices and storage of an app versus its plan limits.",
    inputSchema: { type: "object", properties: { ...appIdProp } },
    run: (api, args, appId) => api.usage(pickApp(args, appId)),
  },
];

export interface McpOptions {
  /** Resolved lazily, so the server starts (and lists tools) even before the user logs in. */
  api: () => Api;
  defaultAppId: () => string | undefined;
  version: string;
}

interface Request {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Json;
}

/** Handles one JSON-RPC message; returns the response, or null for notifications. */
export async function handleMcpMessage(msg: Request, opts: McpOptions): Promise<Json | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (typeof msg !== "object" || msg === null || typeof msg.method !== "string") return fail(-32600, "invalid request");

  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      return reply({
        protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "airdrop", version: opts.version },
        instructions:
          "Manage react-native-airdrop OTA updates: list apps and updates, change rollouts, roll back, resume, promote and check usage. " +
          "Tools default to the app linked in airdrop.config.json; pass appId to target another one.",
      });
    }
    case "ping":
      return isNotification ? null : reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const name = msg.params?.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return fail(-32602, `unknown tool: ${String(name)}`);
      const args = (msg.params?.arguments ?? {}) as Json;
      try {
        const appId = () => {
          const id = opts.defaultAppId();
          if (!id) throw new Error("no app selected: pass appId, or run the server inside a project linked with `airdrop init`");
          return id;
        };
        const result = await tool.run(opts.api(), args, appId);
        return reply({ content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }, null, 2) }], isError: false });
      } catch (err) {
        const status = (err as { status?: number }).status;
        const text = `${status ? `Server error (${status}): ` : ""}${err instanceof Error ? err.message : String(err)}`;
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized, notifications/cancelled, ...
      return fail(-32601, `method not found: ${msg.method}`);
  }
}

export function runMcpServer(opts: McpOptions): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const write = (m: Json) => process.stdout.write(JSON.stringify(m) + "\n");
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg: Request;
    try {
      msg = JSON.parse(line) as Request;
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
      return;
    }
    handleMcpMessage(msg, opts)
      .then((res) => res && write(res))
      .catch((err) => process.stderr.write(`airdrop mcp: ${String(err)}\n`));
  });
  process.stderr.write(`airdrop mcp ${opts.version}: ready on stdio\n`);
  return new Promise((resolve) => rl.on("close", resolve));
}
