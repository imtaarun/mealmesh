import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // No tests exist yet — services get tested starting docs/roadmap.md Phase 2+.
    // Without this, a clean checkout fails `pnpm test` for a reason that has nothing
    // to do with broken code.
    passWithNoTests: true,
  },
});
