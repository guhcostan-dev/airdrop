import fs from "node:fs";
import path from "node:path";
import type { Platform } from "@rn-airdrop/core";

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function findFiles(dir: string, predicate: (name: string) => boolean, depth = 3): string[] {
  if (depth < 0 || !fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["Pods", "build", "node_modules", ".gradle", "DerivedData"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (predicate(entry.name)) out.push(full);
      out.push(...findFiles(full, predicate, depth - 1));
    } else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

function plistString(xml: string, key: string): string | null {
  const m = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(xml);
  return m ? m[1]!.trim() : null;
}

/**
 * The runtime version is the compatibility contract between a native binary
 * and a JS update. It must be computed exactly like the native SDK does:
 *
 *   iOS:     Info.plist `AirdropRuntimeVersion`, else CFBundleShortVersionString
 *   Android: string resource `airdrop_runtime_version`, else versionName
 */
export function detectRuntimeVersion(root: string, platform: Platform): string | null {
  return platform === "ios" ? detectIos(root) : detectAndroid(root);
}

function detectIos(root: string): string | null {
  const iosDir = path.join(root, "ios");
  const plists = findFiles(iosDir, (n) => n === "Info.plist", 2).filter((p) => !/Tests?\//.test(p));
  const pbxprojs = findFiles(iosDir, (n) => n === "project.pbxproj", 2);
  const marketing = pbxprojs
    .map((p) => /MARKETING_VERSION = ([^;]+);/.exec(readIfExists(p) ?? "")?.[1]?.replace(/"/g, "").trim())
    .find(Boolean);
  for (const plist of plists) {
    const xml = readIfExists(plist) ?? "";
    const value = plistString(xml, "AirdropRuntimeVersion") ?? plistString(xml, "CFBundleShortVersionString");
    if (!value) continue;
    if (value.includes("$(MARKETING_VERSION)")) return marketing ?? null;
    return value;
  }
  return marketing ?? null;
}

function detectAndroid(root: string): string | null {
  const strings = readIfExists(path.join(root, "android/app/src/main/res/values/strings.xml"));
  const explicit = strings && /<string name="airdrop_runtime_version"[^>]*>([^<]+)<\/string>/.exec(strings)?.[1];
  if (explicit) return explicit.trim();
  for (const name of ["build.gradle", "build.gradle.kts"]) {
    const gradle = readIfExists(path.join(root, "android/app", name));
    const m = gradle && /versionName\s*=?\s*["']([^"']+)["']/.exec(gradle);
    if (m) return m[1]!;
  }
  return null;
}

export function defaultEntryFile(root: string, platform: Platform): string {
  for (const f of [`index.${platform}.js`, "index.js", "index.ts", "index.tsx"]) {
    if (fs.existsSync(path.join(root, f))) return f;
  }
  return "index.js";
}

export function defaultBundleName(platform: Platform): string {
  return platform === "ios" ? "main.jsbundle" : "index.android.bundle";
}

/** Hermes is the default engine since RN 0.70; honour explicit opt-outs. */
export function isHermesEnabled(root: string, platform: Platform): boolean {
  if (platform === "android") {
    const props = readIfExists(path.join(root, "android/gradle.properties")) ?? "";
    const m = /^\s*hermesEnabled\s*=\s*(true|false)/m.exec(props);
    return m ? m[1] === "true" : true;
  }
  const podfile = readIfExists(path.join(root, "ios/Podfile")) ?? "";
  const m = /:hermes_enabled\s*=>\s*(true|false)/.exec(podfile);
  if (m) return m[1] === "true";
  const props = readIfExists(path.join(root, "ios/Podfile.properties.json"));
  if (props && /"expo.jsEngine"\s*:\s*"jsc"/.test(props)) return false;
  return true;
}

export function findHermesc(root: string): string | null {
  const osDir = process.platform === "darwin" ? "osx-bin" : process.platform === "win32" ? "win64-bin" : "linux64-bin";
  const exe = process.platform === "win32" ? "hermesc.exe" : "hermesc";
  const candidates = [
    // RN >= 0.80 ships hermesc in the hermes-compiler package.
    path.join(root, "node_modules/hermes-compiler/hermesc", osDir, exe),
    path.join(root, "node_modules/react-native/sdks/hermesc", osDir, exe),
    path.join(root, "node_modules/hermes-engine", osDir, exe),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}
