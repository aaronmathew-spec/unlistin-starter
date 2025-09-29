import { test, expect } from "@playwright/test";

test("home renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("health page renders", async ({ page }) => {
  await page.goto("/health");
  await expect(page.getByText(/ok/i)).toBeVisible();
});
