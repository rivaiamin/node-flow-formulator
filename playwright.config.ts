import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Boots the dev server automatically (reusing one if already up).
 * Pinned to the playwright version whose chromium build is already cached,
 * so `playwright test` needs no browser download.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
