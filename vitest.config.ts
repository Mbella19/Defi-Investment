import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // Next's server-only guard throws outside RSC — stub it for node tests.
      "server-only": path.resolve(process.cwd(), "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
});
