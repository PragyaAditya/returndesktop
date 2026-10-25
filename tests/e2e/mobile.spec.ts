import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("shows request cards without a wide table at 375px", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Request queue" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Return requests" })).toBeHidden();
  await expect(page.getByRole("link", { name: /RD-2026-/ }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
