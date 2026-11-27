import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The real react-native entry is Flow; tests use a tiny stand-in.
    alias: { "react-native": new URL("./test/react-native-mock.ts", import.meta.url).pathname },
  },
});
