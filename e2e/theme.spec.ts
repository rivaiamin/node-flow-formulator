import { test, expect } from "@playwright/test";

test("theme toggle switches html class and persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nff-theme"));
  await page.reload();

  const toggle = page.getByRole("button", { name: /switch to (light|dark) mode/i });
  await expect(toggle).toBeVisible();

  // System light → no .dark on html
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: /switch to light mode/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
