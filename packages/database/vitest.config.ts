import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    testTimeout: 60000,
    hookTimeout: 120000, // testcontainers needs time to start
    pool: "forks", // better isolation for database tests
    singleFork: true, // run tests sequentially to avoid DB conflicts
  },
});
