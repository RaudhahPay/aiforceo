import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    css: false
  },
  // Tests are pure unit tests — no CSS / PostCSS processing needed.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  }
});
