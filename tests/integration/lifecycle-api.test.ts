import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as transition } from "@/app/api/requests/[id]/transition/route";
import { POST } from "@/app/api/requests/route";
import { closeDb } from "@/lib/db/client";

config({ path: ".env" });

function testDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "");
  if (!process.env.DATABASE_URL_TEST) {
    url.pathname = "/returndesk_test";
  }
  if (!url.pathname.endsWith("/returndesk_test")) {
    throw new Error("Refusing to run lifecycle tests outside returndesk_test");
  }
  return url.toString();
}

beforeAll(async () => {
  process.env.DATABASE_URL = testDatabaseUrl();
  await closeDb();
});

afterAll(async () => {
  await closeDb();
});

async function createOpen() {
  const response = await POST(
    new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Lifecycle Tester",
        customerEmail: "lifecycle.tester@example.com",
        customerPhone: "555-0160",
        orderReference: `ord-life-${crypto.randomUUID()}`,
        itemName: "Desk lamp",
        itemSku: `sku-life-${crypto.randomUUID()}`,
        quantity: 1,
        reason: "Size Issue",
      }),
    }),
  );
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; status: string }>;
}

function move(id: string, body: unknown) {
  return transition(new Request(`http://localhost/api/requests/${id}/transition`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
}

describe("request lifecycle", () => {
  it("walks the legal path and rejects illegal jumps", async () => {
    const created = await createOpen();

    const skipped = await move(created.id, { status: "Completed" });
    expect(skipped.status).toBe(409);
    await expect(skipped.json()).resolves.toMatchObject({
      error: { code: "INVALID_STATUS_TRANSITION" },
    });

    const review = await move(created.id, { status: "In Review" });
    expect(review.status).toBe(200);
    await expect(review.json()).resolves.toMatchObject({ status: "In Review", resolution: null });

    const approvedWithoutResolution = await move(created.id, { status: "Approved" });
    expect(approvedWithoutResolution.status).toBe(422);

    const replacementWithAmount = await move(created.id, {
      status: "Approved",
      resolution: "Replacement",
      refundAmount: "5.00",
    });
    expect(replacementWithAmount.status).toBe(422);

    const zeroRefund = await move(created.id, {
      status: "Approved",
      resolution: "Refund",
      refundAmount: "0.00",
    });
    expect(zeroRefund.status).toBe(422);

    const approved = await move(created.id, {
      status: "Approved",
      resolution: "Refund",
      refundAmount: "18.5",
    });
    expect(approved.status).toBe(200);
    await expect(approved.json()).resolves.toMatchObject({
      status: "Approved",
      resolution: "Refund",
      refundAmount: "18.50",
    });

    const completedWithNewResolution = await move(created.id, {
      status: "Completed",
      resolution: "Store Credit",
    });
    expect(completedWithNewResolution.status).toBe(422);

    const completed = await move(created.id, { status: "Completed" });
    expect(completed.status).toBe(200);
    await expect(completed.json()).resolves.toMatchObject({
      status: "Completed",
      resolution: "Refund",
      refundAmount: "18.50",
    });

    const afterTerminal = await move(created.id, { status: "In Review" });
    expect(afterTerminal.status).toBe(409);
  });

  it("approves replacement and store credit without an amount, and rejects a terminal request", async () => {
    const replacement = await createOpen();
    expect((await move(replacement.id, { status: "In Review" })).status).toBe(200);
    const replacementApproved = await move(replacement.id, {
      status: "Approved",
      resolution: "Replacement",
    });
    expect(replacementApproved.status).toBe(200);
    await expect(replacementApproved.json()).resolves.toMatchObject({
      resolution: "Replacement",
      refundAmount: null,
    });

    const credit = await createOpen();
    expect((await move(credit.id, { status: "In Review" })).status).toBe(200);
    const creditApproved = await move(credit.id, { status: "Approved", resolution: "Store Credit" });
    expect(creditApproved.status).toBe(200);

    const rejected = await createOpen();
    expect((await move(rejected.id, { status: "In Review" })).status).toBe(200);
    expect((await move(rejected.id, { status: "Rejected" })).status).toBe(200);
    expect((await move(rejected.id, { status: "Approved", resolution: "Refund", refundAmount: "1.00" })).status).toBe(409);
  });

  it("lets only one of two competing transitions win", async () => {
    const created = await createOpen();
    const [first, second] = await Promise.all([
      move(created.id, { status: "In Review" }),
      move(created.id, { status: "In Review" }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
