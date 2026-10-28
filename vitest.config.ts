import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.{ts,tsx}"], setupFiles: ["./test/isolate-home.ts"], testTimeout: 15000 },
});
