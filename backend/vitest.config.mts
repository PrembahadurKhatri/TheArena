import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // describe/it/expect/beforeAll are globals: this package is CommonJS, and
    // importing "vitest" from a CommonJS-compiled test file loads a second
    // copy of it that can't find the running test runner.
    globals: true,
    setupFiles: ["tests/setup.ts"],
    // Each file gets its own in-memory MongoDB; run files one at a time so
    // they don't compete for CPU during the concurrency tests.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
