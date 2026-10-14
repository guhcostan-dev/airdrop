import { describe, expect, it } from "vitest";
import {
  isInRollout,
  isSafeRelativePath,
  rolloutBucket,
  signingMessage,
  validatePublishRequest,
  ValidationError,
} from "../src";

const H = "a".repeat(64);
const H2 = "b".repeat(64);

describe("signingMessage", () => {
  it("is canonical regardless of asset order", () => {
    const base = {
      runtimeVersion: "1.0.0",
      platform: "ios" as const,
      launchAsset: { path: "main.jsbundle", hash: H },
    };
    const a = signingMessage({ ...base, assets: [{ path: "b.png", hash: H2 }, { path: "a.png", hash: H }] });
    const b = signingMessage({ ...base, assets: [{ path: "a.png", hash: H }, { path: "b.png", hash: H2 }] });
    expect(a).toBe(b);
    expect(a).toBe(
      ["airdrop-v1", "1.0.0", "ios", `main.jsbundle:${H}`, `a.png:${H}`, `b.png:${H2}`].join("\n"),
    );
  });
});

describe("isSafeRelativePath", () => {
  it.each([
    ["main.jsbundle", true],
    ["assets/node_modules/foo/img@2x.png", true],
    ["drawable-mdpi/img.png", true],
    ["../etc/passwd", false],
    ["a/../../b", false],
    ["/abs", false],
    ["a//b", false],
    ["a\\b", false],
    ["airdrop-manifest.json", false],
    ["", false],
  ])("%s -> %s", (p, ok) => expect(isSafeRelativePath(p)).toBe(ok));
});

describe("rollout", () => {
  it("is deterministic and roughly uniform", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(await rolloutBucket("device-1", id)).toBe(await rolloutBucket("device-1", id));
    let inside = 0;
    for (let i = 0; i < 2000; i++) if (await isInRollout(`d${i}`, id, 25)) inside++;
    expect(inside).toBeGreaterThan(400);
    expect(inside).toBeLessThan(600);
    expect(await isInRollout("x", id, 100)).toBe(true);
  });
});

describe("validatePublishRequest", () => {
  const valid = {
    id: "00000000-0000-4000-8000-000000000000",
    channel: "production",
    platform: "android",
    runtimeVersion: "1.0.0",
    launchAsset: { path: "index.android.bundle", hash: H, size: 10 },
    assets: [{ path: "drawable-mdpi/logo.png", hash: H2, size: 5 }],
  };
  it("accepts a valid request and fills defaults", () => {
    const r = validatePublishRequest(valid);
    expect(r.rolloutPercentage).toBe(100);
    expect(r.mandatory).toBe(false);
  });
  it("rejects traversal and duplicates", () => {
    expect(() =>
      validatePublishRequest({ ...valid, assets: [{ path: "../x", hash: H, size: 1 }] }),
    ).toThrow(ValidationError);
    expect(() =>
      validatePublishRequest({ ...valid, assets: [{ path: "index.android.bundle", hash: H, size: 1 }] }),
    ).toThrow(/duplicate/);
  });
});
