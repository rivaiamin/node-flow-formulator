import { test, expect, Page } from "@playwright/test";

/**
 * Verifies the React layer that the headless `verify-flow.ts` cannot reach:
 * the example loads, the graph renders, Run Flow propagates, and the Output
 * node displays the number the engine computed.
 *
 * Reference flow + expected value: docs/calculation-graph-editor-contract.md §2c
 * (AIMSIS repo) -> kog_score = 79.06
 */

const loadExample = async (page: Page, name: RegExp = /kog_score/i) => {
  await page.goto("/editor/new");
  await page.waitForSelector(".react-flow");
  await page.getByRole("button", { name: /load example/i }).click();
  await page.getByRole("menuitem", { name }).click();
  await page.waitForSelector(".react-flow__node");
};

test("editor loads the kog_score example graph", async ({ page }) => {
  await loadExample(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await expect(page.locator(".react-flow__edge")).toHaveCount(6);
});

test("combine_by_key exposes exactly one 'values' and one 'weights' handle", async ({ page }) => {
  await loadExample(page);
  // The two-input join is the primitive the whole report-card model depends on.
  await expect(page.locator('.react-flow__handle[data-handleid="values"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__handle[data-handleid="weights"]')).toHaveCount(1);
});

test("Run Flow computes psi_score = 83.39", async ({ page }) => {
  await loadExample(page, /psi_score/i);
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await page.getByRole("button", { name: /run flow/i }).click();
  await expect(page.locator(".text-2xl.font-mono").first()).toHaveText("83.39");
});

test("Run Flow computes kog_score = 79.06 with no node errors", async ({ page }) => {
  await loadExample(page);
  await page.getByRole("button", { name: /run flow/i }).click();

  // Output node renders the final scalar.
  await expect(page.locator(".text-2xl.font-mono").first()).toHaveText("79.06");

  // No node reported a fail-loud error.
  await expect(page.locator(".text-destructive")).toHaveCount(0);
});

test("no uncaught JS errors; only the handled 404 on /api/flows/0", async ({ page }) => {
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  await loadExample(page);
  await page.getByRole("button", { name: /run flow/i }).click();
  await expect(page.locator(".text-2xl.font-mono").first()).toHaveText("79.06");

  expect(pageErrors).toEqual([]);
  // /editor/new legitimately probes /api/flows/0 and the client handles the 404.
  const unexpected = badResponses.filter((r) => !/^404 .*\/api\/flows\/0$/.test(r));
  expect(unexpected).toEqual([]);
});
