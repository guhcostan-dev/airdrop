import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  // Bundle the private workspace package so the published CLI has no deps.
  noExternal: ["@rn-airdrop/core"],
  banner: { js: "#!/usr/bin/env node" },
});
