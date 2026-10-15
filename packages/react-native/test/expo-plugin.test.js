// Plain JS: the plugin is CommonJS and runs in Node (the SDK's tsconfig has no Node types).
import fs from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const t = createRequire(import.meta.url)("../plugin/transforms.js");
const fixture = (name) => fs.readFileSync(new URL(`./fixtures/expo/${name}`, import.meta.url), "utf8");

describe("Expo config plugin transforms", () => {
  it("patches the SDK 57 Swift AppDelegate", () => {
    const out = t.patchAppDelegateSwift(fixture("AppDelegate.sdk57.swift"));
    expect(out).toContain("internal import Expo\nimport ReactNativeAirdrop");
    expect(out).toContain("return RNAirdrop.bundleURL()");
    expect(out).not.toContain('return Bundle.main.url(forResource: "main"');
    // Debug builds keep loading from Metro.
    expect(out).toContain('jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")');
    expect(t.patchAppDelegateSwift(out)).toBe(out); // idempotent
  });

  it("patches the SDK 57 MainApplication (ExpoReactHostFactory)", () => {
    const out = t.patchMainApplicationKotlin(fixture("MainApplication.sdk57.kt"));
    expect(out).toMatch(/context = applicationContext,\n\s+jsBundleFilePath = com\.rnairdrop\.Airdrop\.getJSBundleFile\(applicationContext\),/);
    expect(t.patchMainApplicationKotlin(out)).toBe(out);
  });

  it("patches legacy templates (DefaultReactNativeHost, AppDelegate.mm)", () => {
    const kt = t.patchMainApplicationKotlin(fixture("MainApplication.legacy.kt"));
    expect(kt).toContain("override fun getJSBundleFile(): String? = com.rnairdrop.Airdrop.getJSBundleFile(applicationContext)");
    const mm = t.patchAppDelegateObjc(fixture("AppDelegate.legacy.mm"));
    expect(mm).toContain("#import <ReactNativeAirdrop/RNAirdrop.h>");
    expect(mm).toContain("return [RNAirdrop bundleURL];");
  });

  it("fails loudly on files it doesn't recognize", () => {
    expect(() => t.patchMainApplicationKotlin("class MainApplication")).toThrow(/getting-started/);
    expect(() => t.patchAppDelegateSwift("class AppDelegate {}")).toThrow(/AppDelegate.swift/);
  });

  it("builds native values with the hosted server by default", () => {
    expect(() => t.nativeValues({})).toThrow(/appId/);
    const v = t.nativeValues({ appId: "app-1", publicKey: "PK" });
    expect(t.plistEntries(v)).toEqual({ AirdropServerURL: t.DEFAULT_SERVER, AirdropAppId: "app-1", AirdropPublicKey: "PK" });
    expect(t.stringEntries(v)).toEqual({ airdrop_server_url: t.DEFAULT_SERVER, airdrop_app_id: "app-1", airdrop_public_key: "PK" });
  });
});
