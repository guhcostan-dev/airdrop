import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Per-project config, committed to the app repo (no secrets). */
export interface ProjectConfig {
  serverUrl: string;
  appId: string;
}

/** Per-user credentials, stored outside the repo. */
export interface UserConfig {
  servers: Record<string, { token: string }>;
  defaultServer?: string;
}

export const PROJECT_CONFIG_FILE = "airdrop.config.json";

/** The hosted Airdrop API. Override with --server / AIRDROP_SERVER for another server. */
export const DEFAULT_SERVER = "https://airdrop-api.guhcostan.dev";

function userConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(base, "airdrop", "credentials.json");
}

export function readUserConfig(): UserConfig {
  try {
    return JSON.parse(fs.readFileSync(userConfigPath(), "utf8")) as UserConfig;
  } catch {
    return { servers: {} };
  }
}

export function writeUserConfig(config: UserConfig): void {
  const file = userConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

export function findProjectRoot(start = process.cwd()): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, PROJECT_CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readProjectConfig(root: string): ProjectConfig | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, PROJECT_CONFIG_FILE), "utf8")) as ProjectConfig;
  } catch {
    return null;
  }
}

export function writeProjectConfig(root: string, config: ProjectConfig): void {
  fs.writeFileSync(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");
}

export function normalizeServerUrl(url: string): string {
  const u = new URL(url);
  return u.toString().replace(/\/+$/, "");
}

/**
 * Resolve server + token. Precedence: flags > env (AIRDROP_SERVER/AIRDROP_TOKEN,
 * handy for CI) > project config > stored credentials > the hosted DEFAULT_SERVER.
 */
export function resolveConnection(flags: { server?: string; token?: string }): { serverUrl: string; token: string } {
  const root = findProjectRoot();
  const project = root ? readProjectConfig(root) : null;
  const user = readUserConfig();
  const serverRaw =
    flags.server ?? process.env.AIRDROP_SERVER ?? project?.serverUrl ?? user.defaultServer ?? DEFAULT_SERVER;
  const serverUrl = normalizeServerUrl(serverRaw);
  const token = flags.token ?? process.env.AIRDROP_TOKEN ?? user.servers[serverUrl]?.token;
  if (!token) {
    const hint = serverUrl === DEFAULT_SERVER ? "" : ` --server ${serverUrl}`;
    throw new Error(`No token for ${serverUrl}. Run \`airdrop login${hint} --token <token>\`.`);
  }
  return { serverUrl, token };
}
