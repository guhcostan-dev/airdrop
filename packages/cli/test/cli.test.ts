import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectFiles } from "../src/bundle";
import { detectRuntimeVersion, isHermesEnabled } from "../src/project";
import { generateKeyPair, signUpdate, verifyUpdate } from "../src/signing";
import crypto from "node:crypto";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "airdrop-test-"));
}
function write(root: string, rel: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content);
}

describe("signing", () => {
  it("round-trips and exports a 65-byte uncompressed point", () => {
    const kp = generateKeyPair();
    expect(Buffer.from(kp.publicKey, "base64")).toHaveLength(65);
    const update = {
      runtimeVersion: "1.0.0",
      platform: "ios" as const,
      launchAsset: { path: "main.jsbundle", hash: "a".repeat(64) },
      assets: [{ path: "assets/x.png", hash: "b".repeat(64) }],
    };
    const sig = signUpdate(update, crypto.createPrivateKey(kp.privateKeyPem));
    expect(verifyUpdate(update, sig, kp.publicKey)).toBe(true);
    expect(verifyUpdate({ ...update, runtimeVersion: "2.0.0" }, sig, kp.publicKey)).toBe(false);
  });
});

describe("runtime version detection", () => {
  it("reads Android versionName and the explicit override", () => {
    const root = tmp();
    write(root, "android/app/build.gradle", `android { defaultConfig { versionCode 3\n versionName "1.4.2" } }`);
    expect(detectRuntimeVersion(root, "android")).toBe("1.4.2");
    write(
      root,
      "android/app/src/main/res/values/strings.xml",
      `<resources><string name="airdrop_runtime_version">rt-7</string></resources>`,
    );
    expect(detectRuntimeVersion(root, "android")).toBe("rt-7");
  });

  it("resolves $(MARKETING_VERSION) on iOS", () => {
    const root = tmp();
    write(
      root,
      "ios/Demo/Info.plist",
      `<plist><dict><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string></dict></plist>`,
    );
    write(root, "ios/Demo.xcodeproj/project.pbxproj", `MARKETING_VERSION = 2.1;`);
    expect(detectRuntimeVersion(root, "ios")).toBe("2.1");
  });

  it("defaults to Hermes unless disabled", () => {
    const root = tmp();
    expect(isHermesEnabled(root, "android")).toBe(true);
    write(root, "android/gradle.properties", "hermesEnabled=false\n");
    expect(isHermesEnabled(root, "android")).toBe(false);
  });
});

describe("collectFiles", () => {
  it("separates the launch asset and hashes files", () => {
    const root = tmp();
    write(root, "index.android.bundle", "js");
    write(root, "drawable-mdpi/logo.png", "png");
    write(root, "index.android.bundle.map", "ignored");
    const b = collectFiles(root, "index.android.bundle");
    expect(b.launchAsset.hash).toBe(crypto.createHash("sha256").update("js").digest("hex"));
    expect(b.assets.map((a) => a.path)).toEqual(["drawable-mdpi/logo.png"]);
  });
});
