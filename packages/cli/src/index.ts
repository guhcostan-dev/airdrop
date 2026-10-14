import fs from "node:fs";
import path from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { isPlatform, type Platform } from "@rn-airdrop/core";
import { Api, ApiError } from "./api";
import { buildBundle } from "./bundle";
import {
  findProjectRoot,
  normalizeServerUrl,
  readProjectConfig,
  readUserConfig,
  resolveConnection,
  writeProjectConfig,
  writeUserConfig,
} from "./config";
import { detectRuntimeVersion } from "./project";
import { publishBundle } from "./publish";
import { generateKeyPair, loadPrivateKey, publicKeyFromPrivate } from "./signing";
import { c, formatBytes, log, table } from "./ui";

const VERSION = "0.1.0";

const HELP = `${c.bold("airdrop")} — over-the-air updates for React Native

Usage: airdrop <command> [options]

Setup
  login --server <url> --token <token>   Save credentials for a server
  init --name <app name> [--sign]        Create an app and write airdrop.config.json
  keys generate [--out <file>]           Create a signing key pair and register the public key
  tokens create <name>                   Create an API token (e.g. for CI)
  apps list                              List apps on the server

Releasing
  release --platform <ios|android>       Bundle, (sign,) upload and publish an update
      [--channel production] [--message <text>] [--mandatory] [--rollout <1-100>]
      [--runtime-version <v>] [--private-key <pem>] [--entry-file <file>]
      [--no-hermes] [--bundle-dir <dir> --bundle-name <file>] [--dry-run]
  updates list [--channel] [--platform]  Show recent updates with install/rollback counts
  rollout <updateId> <percent>           Change the rollout percentage
  rollback <updateId>                    Disable an update; devices fall back automatically
  resume <updateId>                      Re-enable a disabled update
  promote <updateId> --to <channel>      Copy an update to another channel

Global options
  --server <url>  --token <token>  (or AIRDROP_SERVER / AIRDROP_TOKEN)
`;

type Values = Record<string, string | boolean | undefined>;

function parse(argv: string[], options: ParseArgsConfig["options"]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: { server: { type: "string" }, token: { type: "string" }, ...options },
  }) as { values: Values; positionals: string[] };
}

function str(v: Values, key: string): string | undefined {
  const x = v[key];
  return typeof x === "string" ? x : undefined;
}

function projectContext(values: Values) {
  const root = findProjectRoot() ?? process.cwd();
  const project = readProjectConfig(root);
  const appId = str(values, "app") ?? process.env.AIRDROP_APP_ID ?? project?.appId;
  if (!appId) throw new Error("No app configured. Run `airdrop init` or pass --app <id>.");
  const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
  return { root, appId, api: new Api(conn.serverUrl, conn.token), serverUrl: conn.serverUrl };
}

function percent(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value.replace(/%$/, ""));
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error("rollout must be an integer between 1 and 100");
  return n;
}

function nativeSnippet(serverUrl: string, appId: string, publicKey?: string) {
  log.info(`
${c.bold("Native configuration")} (see the "Getting started" docs):

  iOS  ${c.dim("ios/<App>/Info.plist")}
    <key>AirdropServerURL</key><string>${serverUrl}</string>
    <key>AirdropAppId</key><string>${appId}</string>${publicKey ? `\n    <key>AirdropPublicKey</key><string>${publicKey}</string>` : ""}

  Android  ${c.dim("android/app/src/main/res/values/strings.xml")}
    <string name="airdrop_server_url">${serverUrl}</string>
    <string name="airdrop_app_id">${appId}</string>${publicKey ? `\n    <string name="airdrop_public_key">${publicKey}</string>` : ""}
`);
}

async function main(argv: string[]) {
  const [cmd, sub, ...rest] = argv;
  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      log.info(HELP);
      return;
    case "--version":
    case "-v":
      log.info(VERSION);
      return;

    case "login": {
      const { values } = parse(argv.slice(1), {});
      const server = str(values, "server");
      const token = str(values, "token");
      if (!server || !token) throw new Error("usage: airdrop login --server <url> --token <token>");
      const url = normalizeServerUrl(server);
      await new Api(url, token).listApps(); // validates the token
      const cfg = readUserConfig();
      cfg.servers[url] = { token };
      cfg.defaultServer = url;
      writeUserConfig(cfg);
      log.ok(`Logged in to ${url}`);
      return;
    }

    case "init": {
      const { values } = parse(argv.slice(1), {
        name: { type: "string" },
        sign: { type: "boolean" },
        "key-out": { type: "string" },
      });
      const root = process.cwd();
      const existing = readProjectConfig(root);
      if (existing) throw new Error(`airdrop.config.json already exists (app ${existing.appId})`);
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      const api = new Api(conn.serverUrl, conn.token);
      let name = str(values, "name");
      if (!name) {
        try {
          name = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).name;
        } catch {}
      }
      if (!name) throw new Error("pass --name <app name>");
      let publicKey: string | undefined;
      if (values.sign) {
        const keyOut = path.resolve(str(values, "key-out") ?? "airdrop-private-key.pem");
        const kp = generateKeyPair();
        fs.writeFileSync(keyOut, kp.privateKeyPem, { mode: 0o600 });
        publicKey = kp.publicKey;
        log.ok(`Private key written to ${keyOut} — keep it secret, do NOT commit it`);
      }
      const app = await api.createApp(name, publicKey);
      writeProjectConfig(root, { serverUrl: conn.serverUrl, appId: app.id });
      log.ok(`Created app "${app.name}" (${app.id}) and wrote airdrop.config.json`);
      nativeSnippet(conn.serverUrl, app.id, publicKey);
      return;
    }

    case "keys": {
      if (sub !== "generate") throw new Error("usage: airdrop keys generate [--out <file>]");
      const { values } = parse(rest, { out: { type: "string" }, app: { type: "string" }, "no-register": { type: "boolean" } });
      const out = path.resolve(str(values, "out") ?? "airdrop-private-key.pem");
      if (fs.existsSync(out)) throw new Error(`${out} already exists`);
      const kp = generateKeyPair();
      fs.writeFileSync(out, kp.privateKeyPem, { mode: 0o600 });
      log.ok(`Private key written to ${out} — keep it secret, do NOT commit it`);
      log.info(`Public key: ${c.cyan(kp.publicKey)}`);
      if (!values["no-register"]) {
        const ctx = projectContext(values);
        await ctx.api.updateApp(ctx.appId, { signingPublicKey: kp.publicKey });
        log.ok("Registered public key with the server; unsigned updates will now be rejected");
        nativeSnippet(ctx.serverUrl, ctx.appId, kp.publicKey);
      }
      return;
    }

    case "tokens": {
      if (sub !== "create" || !rest[0]) throw new Error("usage: airdrop tokens create <name>");
      const { values, positionals } = parse(rest, {});
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      const t = await new Api(conn.serverUrl, conn.token).createToken(positionals[0]!);
      log.ok(`Token "${t.name}" created. It is shown only once:\n\n  ${t.token}\n`);
      return;
    }

    case "apps": {
      const { values } = parse(argv.slice(2), {});
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      const apps = await new Api(conn.serverUrl, conn.token).listApps();
      table(apps.map((a) => ({ id: a.id, name: a.name, signed: a.signingPublicKey ? "yes" : "no", created: a.createdAt })));
      if (!apps.length) log.info("No apps yet. Run `airdrop init`.");
      return;
    }

    case "release": {
      const { values } = parse(argv.slice(1), {
        platform: { type: "string", short: "p" },
        channel: { type: "string", short: "c" },
        message: { type: "string", short: "m" },
        mandatory: { type: "boolean" },
        rollout: { type: "string" },
        "runtime-version": { type: "string" },
        "private-key": { type: "string" },
        "entry-file": { type: "string" },
        "no-hermes": { type: "boolean" },
        "bundle-dir": { type: "string" },
        "bundle-name": { type: "string" },
        "dry-run": { type: "boolean" },
        app: { type: "string" },
      });
      const platform = str(values, "platform");
      if (!isPlatform(platform)) throw new Error("--platform must be ios or android");
      const ctx = projectContext(values);
      const runtimeVersion = str(values, "runtime-version") ?? detectRuntimeVersion(ctx.root, platform);
      if (!runtimeVersion)
        throw new Error("Could not detect the runtime version from the native project; pass --runtime-version");
      const keyPath = str(values, "private-key") ?? process.env.AIRDROP_PRIVATE_KEY_PATH;
      const privateKey = keyPath ? loadPrivateKey(keyPath) : undefined;

      const app = await ctx.api.getApp(ctx.appId);
      if (app.signingPublicKey && !privateKey)
        throw new Error("This app requires signed updates: pass --private-key <pem> (or AIRDROP_PRIVATE_KEY_PATH)");
      if (privateKey && app.signingPublicKey && publicKeyFromPrivate(privateKey) !== app.signingPublicKey)
        throw new Error("The private key does not match the public key registered for this app");

      const channel = str(values, "channel") ?? "production";
      log.info(`${c.bold("Releasing")} ${app.name} • ${platform} • runtime ${runtimeVersion} • channel ${channel}`);
      const built = buildBundle({
        root: ctx.root,
        platform: platform as Platform,
        entryFile: str(values, "entry-file"),
        hermes: values["no-hermes"] ? false : undefined,
        bundleDir: str(values, "bundle-dir"),
        bundleName: str(values, "bundle-name"),
      });
      if (values["dry-run"]) {
        log.ok(`Dry run: bundle at ${built.dir} (${built.assets.length + 1} files, ${formatBytes(built.launchAsset.size)} JS)`);
        return;
      }
      const update = await publishBundle({
        api: ctx.api,
        appId: ctx.appId,
        dir: built.dir,
        launchAsset: built.launchAsset,
        assets: built.assets,
        platform: platform as Platform,
        runtimeVersion,
        channel,
        message: str(values, "message"),
        mandatory: !!values.mandatory,
        rolloutPercentage: percent(str(values, "rollout")),
        privateKey,
      });
      log.ok(
        `Published update ${c.cyan(update.id)} (${update.rolloutPercentage}% rollout${update.signature ? ", signed" : ""})`,
      );
      return;
    }

    case "updates": {
      const { values } = parse(argv.slice(2), {
        channel: { type: "string" },
        platform: { type: "string" },
        limit: { type: "string" },
        app: { type: "string" },
      });
      const ctx = projectContext(values);
      const updates = await ctx.api.listUpdates(ctx.appId, {
        channel: str(values, "channel"),
        platform: str(values, "platform"),
        limit: str(values, "limit"),
      });
      table(
        updates.map((u) => ({
          id: u.id,
          created: u.createdAt.replace("T", " ").slice(0, 19),
          platform: u.platform,
          runtime: u.runtimeVersion,
          channel: u.channel,
          status: u.enabled ? `${u.rolloutPercentage}%` : "disabled",
          installs: String(u.stats?.install ?? 0),
          rollbacks: String(u.stats?.rollback ?? 0),
          message: (u.message ?? "").slice(0, 40),
        })),
      );
      if (!updates.length) log.info("No updates yet.");
      return;
    }

    case "rollout":
    case "rollback":
    case "resume": {
      const { values, positionals } = parse(argv.slice(1), { app: { type: "string" } });
      const id = positionals[0];
      if (!id) throw new Error(`usage: airdrop ${cmd} <updateId>${cmd === "rollout" ? " <percent>" : ""}`);
      const ctx = projectContext(values);
      const patch =
        cmd === "rollout"
          ? { rolloutPercentage: percent(positionals[1]) }
          : { enabled: cmd === "resume" };
      if (cmd === "rollout" && patch.rolloutPercentage === undefined) throw new Error("missing percent");
      const u = await ctx.api.patchUpdate(ctx.appId, id, patch);
      log.ok(`Update ${u.id}: ${u.enabled ? `enabled at ${u.rolloutPercentage}%` : "disabled (devices will roll back)"}`);
      return;
    }

    case "promote": {
      const { values, positionals } = parse(argv.slice(1), {
        to: { type: "string" },
        rollout: { type: "string" },
        app: { type: "string" },
      });
      const id = positionals[0];
      const to = str(values, "to");
      if (!id || !to) throw new Error("usage: airdrop promote <updateId> --to <channel>");
      const ctx = projectContext(values);
      const u = await ctx.api.promoteUpdate(ctx.appId, id, { channel: to, rolloutPercentage: percent(str(values, "rollout")) });
      log.ok(`Promoted to ${to} as ${u.id}`);
      return;
    }

    default:
      throw new Error(`unknown command "${cmd}". Run \`airdrop help\`.`);
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  if (err instanceof ApiError) log.error(`Server error (${err.status}): ${err.message}`);
  else log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
