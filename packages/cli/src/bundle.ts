import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Platform, UpdateFile } from "@rn-airdrop/core";
import { defaultBundleName, defaultEntryFile, findHermesc, isHermesEnabled } from "./project";
import { log } from "./ui";

export interface BundleOptions {
  root: string;
  platform: Platform;
  entryFile?: string;
  hermes?: boolean;
  /** Use an already-built output directory instead of running the bundler. */
  bundleDir?: string;
  bundleName?: string;
  extraBundlerArgs?: string[];
}

export interface BuiltBundle {
  dir: string;
  launchAsset: UpdateFile;
  assets: UpdateFile[];
}

function run(cmd: string, args: string[], cwd: string) {
  log.dim(`$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) throw new Error(`${cmd} exited with code ${res.status}`);
}

function reactNativeBin(root: string): { cmd: string; args: string[] } {
  const local = path.join(root, "node_modules/.bin/react-native");
  if (fs.existsSync(local)) return { cmd: local, args: [] };
  return { cmd: "npx", args: ["react-native"] };
}

export function buildBundle(opts: BundleOptions): BuiltBundle {
  const bundleName = opts.bundleName ?? defaultBundleName(opts.platform);
  let dir: string;
  if (opts.bundleDir) {
    dir = path.resolve(opts.bundleDir);
    if (!fs.existsSync(path.join(dir, bundleName)))
      throw new Error(`${bundleName} not found in ${dir} (use --bundle-name to override)`);
  } else {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), `airdrop-${opts.platform}-`));
    const entryFile = opts.entryFile ?? defaultEntryFile(opts.root, opts.platform);
    const rn = reactNativeBin(opts.root);
    run(
      rn.cmd,
      [
        ...rn.args,
        "bundle",
        "--platform",
        opts.platform,
        "--dev",
        "false",
        "--minify",
        "true",
        "--entry-file",
        entryFile,
        "--bundle-output",
        path.join(dir, bundleName),
        "--assets-dest",
        dir,
        "--sourcemap-output",
        path.join(os.tmpdir(), `airdrop-${process.pid}-${opts.platform}.map`),
        ...(opts.extraBundlerArgs ?? []),
      ],
      opts.root,
    );

    const hermes = opts.hermes ?? isHermesEnabled(opts.root, opts.platform);
    if (hermes) {
      const hermesc = findHermesc(opts.root);
      if (!hermesc) {
        log.warn("Hermes is enabled but hermesc was not found; shipping plain JS (slower startup). Use --no-hermes to silence.");
      } else {
        const jsPath = path.join(dir, bundleName);
        const hbcPath = `${jsPath}.hbc`;
        run(hermesc, ["-emit-binary", "-O", "-max-diagnostic-width=80", "-w", "-out", hbcPath, jsPath], opts.root);
        fs.renameSync(hbcPath, jsPath);
      }
    }
  }
  return collectFiles(dir, bundleName);
}

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function collectFiles(dir: string, bundleName: string): BuiltBundle {
  const assets: UpdateFile[] = [];
  let launchAsset: UpdateFile | null = null;
  const walk = (sub: string) => {
    for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(rel);
        continue;
      }
      if (entry.name === ".DS_Store" || entry.name.endsWith(".map")) continue;
      const full = path.join(dir, rel);
      const file: UpdateFile = { path: rel, hash: sha256File(full), size: fs.statSync(full).size };
      if (rel === bundleName) launchAsset = file;
      else assets.push(file);
    }
  };
  walk("");
  if (!launchAsset) throw new Error(`bundle ${bundleName} missing from ${dir}`);
  assets.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { dir, launchAsset, assets };
}
