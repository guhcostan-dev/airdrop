import fs from "node:fs";
import path from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { isPlatform, type Platform } from "@rn-airdrop/core";
import { Api, ApiError } from "./api";
import { buildBundle } from "./bundle";
import {
  DEFAULT_SERVER,
  findProjectRoot,
  normalizeServerUrl,
  readProjectConfig,
  readUserConfig,
  resolveConnection,
  writeProjectConfig,
  writeUserConfig,
} from "./config";
import { runMcpServer } from "./mcp";
import { detectRuntimeVersion } from "./project";
import { ask, askHidden } from "./prompt";
import { publishBundle } from "./publish";
import { generateKeyPair, loadPrivateKey, publicKeyFromPrivate } from "./signing";
import { c, formatBytes, log, table } from "./ui";

const VERSION = "0.3.0";

/** What happens if the email is never confirmed (server rule, src/verification.ts there). */
function verifyHint(verifyBy: string | null | undefined): string {
  const by = verifyBy ? ` by ${verifyBy.slice(0, 10)}` : "";
  return `Confirm it${by} to keep access to your apps and to create a second free app (\`airdrop resend-verification\` sends a new link).`;
}

const HELP = `${c.bold("airdrop")} — over-the-air updates for React Native

Usage: airdrop <command> [options]

Account
  signup [--email <email>]               Create a free account (asks for a password)
  login [--email <email>]                Sign in with email + password (default server: ${DEFAULT_SERVER})
  login --token <token>                  Use an API token instead (CI token or operator token)
  logout                                 Sign out and forget the stored credentials
  forgot-password [--email <email>]      Email a link to choose a new password
  resend-verification                    Email a new link to confirm your address
  whoami                                 Show who you are signed in as

Setup
  init [--app <id> | --name <name>] [--sign]
                                         Pick or create your app and write airdrop.config.json
  keys generate [--out <file>]           Create a signing key pair and register the public key
  apps list                              List your apps
  apps create <name>                     Create an app
  tokens create <name>                   Create a CI token for this app (shown once)
  tokens list | tokens revoke <id>       Manage this app's CI tokens
  usage                                  Monthly active devices and storage vs your plan
  mcp                                    Run an MCP server on stdio (for AI assistants)

Operator (full-access token)
  apps plan <appId> <plan>               Set an app's plan (free, pro, scale, enterprise)
  tokens create <name> --operator [--app <id>]
                                         Create a global token (full access unless --app)
  waitlist                               Show old early-access signups

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

    case "signup":
    case "login": {
      const { values } = parse(argv.slice(1), { email: { type: "string" } });
      const url = normalizeServerUrl(str(values, "server") ?? process.env.AIRDROP_SERVER ?? DEFAULT_SERVER);
      const token = str(values, "token");
      const cfg = readUserConfig();
      let verifyBy: string | null | undefined;
      if (token && cmd === "login") {
        await new Api(url, token).listApps(); // validates the token
        cfg.servers[url] = { token };
      } else {
        const email = str(values, "email") ?? (await ask("Email: "));
        if (!email) throw new Error(`usage: airdrop ${cmd} [--email <email>]`);
        const password = process.env.AIRDROP_PASSWORD ?? (await askHidden("Password: "));
        if (cmd === "signup" && !process.env.AIRDROP_PASSWORD && process.stdin.isTTY) {
          if ((await askHidden("Repeat password: ")) !== password) throw new Error("passwords don't match");
        }
        const session = cmd === "signup" ? await Api.signup(url, email, password) : await Api.login(url, email, password);
        cfg.servers[url] = { token: session.token, email: session.user.email };
        verifyBy = session.user.verifyBy;
      }
      cfg.defaultServer = url;
      writeUserConfig(cfg);
      const who = cfg.servers[url]!.email ? ` as ${cfg.servers[url]!.email}` : "";
      log.ok(`${cmd === "signup" ? "Account created. Signed in" : "Logged in"} to ${url}${who}`);
      if (cmd === "signup") {
        log.info(`We sent a confirmation link to ${cfg.servers[url]!.email}. ${verifyHint(verifyBy)}`);
        log.info(`Next: run ${c.cyan("airdrop init")} in your React Native project.`);
      }
      return;
    }

    case "forgot-password": {
      const { values } = parse(argv.slice(1), { email: { type: "string" } });
      const url = normalizeServerUrl(str(values, "server") ?? process.env.AIRDROP_SERVER ?? readUserConfig().defaultServer ?? DEFAULT_SERVER);
      const email = str(values, "email") ?? (await ask("Email: "));
      if (!email) throw new Error("usage: airdrop forgot-password [--email <email>]");
      await Api.forgotPassword(url, email);
      log.ok(`If an account exists for ${email}, a link to choose a new password is on its way (valid for 1 hour).`);
      return;
    }

    case "resend-verification": {
      const { values } = parse(argv.slice(1), {});
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      const res = await new Api(conn.serverUrl, conn.token).resendVerification();
      if (res.alreadyVerified) log.ok("Your email is already confirmed.");
      else log.ok("A new confirmation link is on its way (at most one per minute).");
      return;
    }

    case "logout": {
      const { values } = parse(argv.slice(1), {});
      const cfg = readUserConfig();
      const url = normalizeServerUrl(str(values, "server") ?? process.env.AIRDROP_SERVER ?? cfg.defaultServer ?? DEFAULT_SERVER);
      const saved = cfg.servers[url];
      if (!saved) {
        log.info(`Not signed in to ${url}.`);
        return;
      }
      if (saved.email) await new Api(url, saved.token).logout().catch(() => undefined);
      delete cfg.servers[url];
      if (cfg.defaultServer === url) delete cfg.defaultServer;
      writeUserConfig(cfg);
      log.ok(`Signed out of ${url}`);
      return;
    }

    case "whoami": {
      const { values } = parse(argv.slice(1), {});
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      const me = await new Api(conn.serverUrl, conn.token).me();
      if (me.user)
        log.info(
          `${me.user.email} on ${conn.serverUrl}` +
            (me.user.emailVerified === false ? ` (email not confirmed: ${verifyHint(me.user.verifyBy)})` : ""),
        );
      else if (me.appId) log.info(`API token for app ${me.appId} on ${conn.serverUrl}`);
      else log.info(`Operator token on ${conn.serverUrl}`);
      return;
    }

    case "mcp": {
      const { values } = parse(argv.slice(1), { app: { type: "string" } });
      let api: Api | undefined;
      await runMcpServer({
        version: VERSION,
        api: () => {
          if (!api) {
            const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
            api = new Api(conn.serverUrl, conn.token);
          }
          return api;
        },
        defaultAppId: () => {
          const root = findProjectRoot();
          return str(values, "app") ?? process.env.AIRDROP_APP_ID ?? (root ? readProjectConfig(root)?.appId : undefined);
        },
      });
      return;
    }

    case "init": {
      const { values } = parse(argv.slice(1), {
        name: { type: "string" },
        app: { type: "string" },
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
      let linkId = str(values, "app");
      const nameFlag = str(values, "name");
      if (!linkId && !nameFlag && process.stdin.isTTY) {
        // Signed-in users (and operators) pick one of their apps or create a new one.
        const apps = await api.listApps();
        if (apps.length) {
          log.info(c.bold("Which app is this project?"));
          apps.forEach((a, i) => log.info(`  ${i + 1}) ${a.name} ${c.dim(a.id)}`));
          log.info(`  n) Create a new app${name ? ` "${name}"` : ""}`);
          const choice = (await ask("Choose [n]: ")).toLowerCase();
          const picked = apps[Number(choice) - 1];
          if (picked) linkId = picked.id;
          else if (choice && choice !== "n") throw new Error(`invalid choice "${choice}"`);
        }
        if (!linkId && !name) name = (await ask("App name: ")) || undefined;
      }
      if (!linkId && !name) throw new Error("pass --app <id> to link your app, or --name <app name> to create one");
      let publicKey: string | undefined;
      if (values.sign) {
        const keyOut = path.resolve(str(values, "key-out") ?? "airdrop-private-key.pem");
        const kp = generateKeyPair();
        fs.writeFileSync(keyOut, kp.privateKeyPem, { mode: 0o600 });
        publicKey = kp.publicKey;
        log.ok(`Private key written to ${keyOut} — keep it secret, do NOT commit it`);
      }
      const link = async (id: string) => {
        const found = await api.getApp(id);
        return publicKey ? api.updateApp(found.id, { signingPublicKey: publicKey }) : found;
      };
      let app;
      let linked = !!linkId;
      if (linkId) {
        app = await link(linkId);
      } else {
        try {
          app = await api.createApp(name!, publicKey);
        } catch (err) {
          // Customer tokens are scoped to one app and can't create apps: link that app instead.
          if (!(err instanceof ApiError && err.status === 403)) throw err;
          const apps = await api.listApps();
          if (apps.length !== 1) throw err;
          app = await link(apps[0]!.id);
          linked = true;
        }
      }
      writeProjectConfig(root, { serverUrl: conn.serverUrl, appId: app.id });
      log.ok(`${linked ? "Linked" : "Created"} app "${app.name}" (${app.id}) and wrote airdrop.config.json`);
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
      const { values, positionals } = parse(rest, { app: { type: "string" }, operator: { type: "boolean" } });
      if (sub === "create" && values.operator) {
        if (!positionals[0]) throw new Error("usage: airdrop tokens create <name> --operator [--app <id>]");
        const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
        const t = await new Api(conn.serverUrl, conn.token).createToken(positionals[0], str(values, "app"));
        const scope = t.appId ? ` (scoped to app ${t.appId})` : " (full access)";
        log.ok(`Token "${t.name}" created${scope}. It is shown only once:\n\n  ${t.token}\n`);
        return;
      }
      const ctx = projectContext(values);
      if (sub === "create") {
        if (!positionals[0]) throw new Error("usage: airdrop tokens create <name>");
        const t = await ctx.api.createAppToken(ctx.appId, positionals[0]);
        log.ok(`CI token "${t.name}" created for app ${t.appId}. It is shown only once:\n\n  ${t.token}\n`);
        log.info(`Use it in CI as ${c.cyan("AIRDROP_TOKEN")}: it can publish and manage releases of this app only.`);
        return;
      }
      if (sub === "list") {
        const tokens = await ctx.api.listAppTokens(ctx.appId);
        table(tokens.map((t) => ({ id: t.id, name: t.name, created: t.createdAt.slice(0, 10), "last used": t.lastUsedAt?.slice(0, 10) ?? "never" })));
        if (!tokens.length) log.info("No tokens yet. Run `airdrop tokens create ci`.");
        return;
      }
      if (sub === "revoke") {
        if (!positionals[0]) throw new Error("usage: airdrop tokens revoke <id>");
        await ctx.api.revokeAppToken(ctx.appId, positionals[0]);
        log.ok(`Token ${positionals[0]} revoked`);
        return;
      }
      throw new Error("usage: airdrop tokens <create|list|revoke> ...");
    }

    case "apps": {
      const { values, positionals } = parse(argv.slice(2), {});
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      if (sub === "plan") {
        const [appId, plan] = positionals;
        if (!appId || !plan) throw new Error("usage: airdrop apps plan <appId> <free|pro|scale|enterprise>");
        const updated = await new Api(conn.serverUrl, conn.token).updateApp(appId, { plan });
        log.ok(`App "${updated.name}" is now on the ${updated.plan} plan`);
        return;
      }
      if (sub === "create") {
        if (!positionals[0]) throw new Error("usage: airdrop apps create <name>");
        const created = await new Api(conn.serverUrl, conn.token).createApp(positionals[0]);
        log.ok(`Created app "${created.name}": ${created.id}`);
        return;
      }
      const apps = await new Api(conn.serverUrl, conn.token).listApps();
      table(apps.map((a) => ({ id: a.id, name: a.name, plan: a.plan ?? "", signed: a.signingPublicKey ? "yes" : "no", created: a.createdAt })));
      if (!apps.length) log.info("No apps yet. Run `airdrop init`.");
      return;
    }

    case "waitlist": {
      const { values } = parse(argv.slice(1), {});
      const conn = resolveConnection({ server: str(values, "server"), token: str(values, "token") });
      const entries = await new Api(conn.serverUrl, conn.token).listWaitlist();
      table(entries.map((e) => ({ created: e.createdAt.slice(0, 16).replace("T", " "), email: e.email, app: e.appName ?? "", mau: e.mau ?? "" })));
      if (!entries.length) log.info("No signups yet.");
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

    case "usage": {
      const { values } = parse(argv.slice(1), { app: { type: "string" } });
      const ctx = projectContext(values);
      const u = await ctx.api.usage(ctx.appId);
      const pct = (n: number, d: number | null) => (d ? ` (${Math.round((n / d) * 100)}%)` : "");
      const limit = (d: number | null, f = (x: number) => x.toLocaleString("en-US")) => (d === null ? "unlimited" : f(d));
      log.info(`${c.bold(u.plan)} plan · ${u.month}`);
      log.info(`  Monthly active devices  ${u.activeDevices.toLocaleString("en-US")} / ${limit(u.activeDevicesLimit)}${pct(u.activeDevices, u.activeDevicesLimit)}`);
      log.info(`  Storage                 ${formatBytes(u.storageBytes)} / ${limit(u.storageBytesLimit, formatBytes)}${pct(u.storageBytes, u.storageBytesLimit)}`);
      if (u.overLimit) log.warn("Over your plan's limit: devices keep working, but new releases are blocked until you upgrade.");
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
