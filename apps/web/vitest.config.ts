import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@emaily/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@emaily/database": path.resolve(__dirname, "../../packages/database/src"),
    },
  },
});
