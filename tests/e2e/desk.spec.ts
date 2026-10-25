import { expect, test } from "@playwright/test";

test("searches, filters, paginates, and opens a seeded request", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Request queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: /RD-2026-/ }).first()).toBeVisible();

  await page.getByRole("searchbox", { name: "Search" }).fill("RD-2026-000021");
  await expect(page.getByRole("link", { name: /RD-2026-/ })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "RD-2026-000021" })).toBeVisible();

  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("Rejected");
  await expect(page.locator("table").getByText("Rejected", { exact: true })).toHaveCount(1);

  await page.getByRole("searchbox", { name: "Search" }).fill("");
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("");
  await expect(page.getByRole("link", { name: /RD-2026-/ })).toHaveCount(20);
  await page.getByRole("combobox", { name: "Page size" }).selectOption("10");
  await expect(page.getByRole("link", { name: /RD-2026-/ })).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of")).toBeVisible();

  await page.getByRole("link", { name: /RD-2026-/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD-2026-");
});

test("creates, edits, notes, approves, and completes a request", async ({ page }) => {
  const order = `ORD-E2E-${Date.now()}`;
  await page.goto("/requests/new");
  await page.getByRole("textbox", { name: "Customer name", exact: true }).fill("End To End");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("end.to.end@example.com");
  await page.getByRole("textbox", { name: "Phone", exact: true }).fill("555-0188");
  await page.getByRole("textbox", { name: "Order reference", exact: true }).fill(order);
  await page.getByRole("textbox", { name: "Item", exact: true }).fill("Desk lamp");
  await page.getByRole("textbox", { name: "SKU", exact: true }).fill("SKU-E2E-LAMP");
  await page.getByRole("textbox", { name: "Quantity", exact: true }).fill("2");
  await page.getByRole("combobox", { name: "Reason", exact: true }).selectOption("Damaged");
  await page.getByRole("button", { name: "Create request" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD-");
  await page.getByRole("textbox", { name: "Customer name", exact: true }).fill("End To End Updated");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Details saved.")).toBeVisible();

  await page.getByRole("textbox", { name: "Add a note", exact: true }).fill("Packed for inspection");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Packed for inspection")).toBeVisible();

  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByText("Moved to In Review.")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("combobox", { name: "Resolution", exact: true }).selectOption("Refund");
  await page.getByRole("textbox", { name: "Refund amount", exact: true }).fill("12.50");
  await page.getByRole("button", { name: "Save approval" }).click();
  await expect(page.getByText("Moved to Approved.")).toBeVisible();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText("Moved to Completed.")).toBeVisible();
  await expect(page.getByText("This request is closed.")).toBeVisible();
});

test("rejects a duplicate, then rejects and removes another request", async ({ page }) => {
  const order = `ORD-DUP-${Date.now()}`;
  const sku = `SKU-DUP-${Date.now()}`;

  async function fill(path = "/requests/new") {
    await page.goto(path);
    await page.getByRole("textbox", { name: "Customer name", exact: true }).fill("Duplicate Case");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("duplicate.case@example.com");
    await page.getByRole("textbox", { name: "Phone", exact: true }).fill("555-0189");
    await page.getByRole("textbox", { name: "Order reference", exact: true }).fill(order);
    await page.getByRole("textbox", { name: "Item", exact: true }).fill("Wool cap");
    await page.getByRole("textbox", { name: "SKU", exact: true }).fill(sku);
    await page.getByRole("textbox", { name: "Quantity", exact: true }).fill("1");
    await page.getByRole("combobox", { name: "Reason", exact: true }).selectOption("Changed Mind");
  }

  await fill();
  await page.getByRole("button", { name: "Create request" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD-");

  await fill();
  await page.getByRole("button", { name: "Create request" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "live request already exists" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Customer name", exact: true })).toHaveValue("Duplicate Case");

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search" }).fill(order);
  await page.getByRole("link", { name: /RD-/ }).first().click();
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Moved to Rejected.")).toBeVisible();
  await page.getByRole("button", { name: "Remove request" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove request" }).click();
  await expect(page.getByRole("heading", { name: "Request queue" })).toBeVisible();
});

test("shows an API error and a network failure on the queue", async ({ page }) => {
  await page.route("**/api/requests?*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Unexpected server error.", details: null },
      }),
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Unexpected server error." })).toBeVisible();

  await page.unroute("**/api/requests?*");
  await page.route("**/api/requests?*", (route) => route.abort());
  await page.getByRole("searchbox", { name: "Search" }).fill("network-down");
  await expect(page.getByRole("alert").filter({ hasText: "Failed to fetch" })).toBeVisible();
});
