import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Tests run against the PRODUCTION build (`pnpm build && pnpm start`),
 * not the dev server: this project's proxied dev HMR can't recover from Vite's
 * mid-session dep re-optimize, which makes dev-server E2E non-deterministic. The
 * prod server has no Vite/HMR/optimize — it serves static assets + the API, so
 * the suite is stable and also exercises the real bundle.
 *
 * Pinned to the playwright version whose chromium build is already cached.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:5000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
