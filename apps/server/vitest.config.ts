import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { ADMIN_TOKEN: "test-admin-token", CHECK_CACHE_TTL: "0", WEB_ORIGINS: "https://site.test", USAGE_FLUSH_MS: "0", STRIPE_WEBHOOK_SECRET: "whsec_test", AWS_ORIGIN: "", TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
});
