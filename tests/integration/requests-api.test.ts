import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getRequestRoute } from "@/app/api/requests/[id]/route";
import { GET, POST } from "@/app/api/requests/route";
import { closeDb } from "@/lib/db/client";

config({ path: ".env" });

function testDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "");
  if (!process.env.DATABASE_URL_TEST) {
    url.pathname = "/returndesk_test";
  }
  if (!url.pathname.endsWith("/returndesk_test")) {
    throw new Error("Refusing to run API tests outside returndesk_test");
  }
  return url.toString();
}

const databaseUrl = testDatabaseUrl();

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl;
  await closeDb();
});

afterAll(async () => {
  await closeDb();
});

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Quinn Search",
    customerEmail: "quinn.search@example.com",
    customerPhone: "555-0142",
    orderReference: `ord-api-${crypto.randomUUID()}`,
    itemName: "Canvas tote",
    itemSku: `sku-api-${crypto.randomUUID()}`,
    quantity: 1,
    reason: "Damaged",
    ...overrides,
  };
}

async function postRequest(body: unknown) {
  return POST(
    new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("request creation and listing", () => {
  it("creates an Open request and refuses a second live request for the same order item", async () => {
    const body = createBody();
    const created = await postRequest(body);
    expect(created.status).toBe(201);
    const first = await created.json();
    expect(first.status).toBe("Open");
    expect(first.reference).toMatch(/^RD-\d{4}-\d{6}$/);
    expect(first.orderReference).toBe(String(body.orderReference).toUpperCase());
    expect(first.itemSku).toBe(String(body.itemSku).toUpperCase());
    expect(first.customerEmail).toBe("quinn.search@example.com");
    expect(first.notes).toEqual([]);

    const duplicate = await postRequest(body);
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: { code: "DUPLICATE_LIVE_REQUEST" },
    });
  });

  it("returns 400 for malformed JSON and 422 for an invalid list query", async () => {
    const malformed = await POST(
      new Request("http://localhost/api/requests", { method: "POST", body: "{" }),
    );
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ error: { code: "INVALID_JSON" } });

    const invalid = await GET(new Request("http://localhost/api/requests?sort=drop+table"));
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: "INVALID_QUERY" } });
  });

  it("searches, filters, sorts, and pages in one query result", async () => {
    const marker = `marker-${crypto.randomUUID().slice(0, 8)}`;
    const older = await postRequest(
      createBody({
        customerName: `${marker} Ada`,
        reason: "Damaged",
        orderReference: `ord-${marker}-a`,
        itemSku: `sku-${marker}-a`,
      }),
    );
    const newer = await postRequest(
      createBody({
        customerName: `${marker} Bea`,
        reason: "Changed Mind",
        orderReference: `ord-${marker}-b`,
        itemSku: `sku-${marker}-b`,
      }),
    );
    const olderBody = await older.json();
    const newerBody = await newer.json();

    const listed = await GET(
      new Request(`http://localhost/api/requests?q=${marker}&sort=customerName&direction=asc&pageSize=1&page=1`),
    );
    expect(listed.status).toBe(200);
    const page = await listed.json();
    expect(page.total).toBe(2);
    expect(page.requests).toHaveLength(1);
    expect(page.requests[0].customerName).toBe(`${marker} Ada`);

    const second = await GET(
      new Request(`http://localhost/api/requests?q=${marker}&sort=customerName&direction=asc&pageSize=1&page=2`),
    );
    const secondPage = await second.json();
    expect(secondPage.requests[0].customerName).toBe(`${marker} Bea`);

    const filtered = await GET(
      new Request(`http://localhost/api/requests?q=${marker}&status=Open&reason=Damaged`),
    );
    const filteredBody = await filtered.json();
    expect(filteredBody.total).toBe(1);
    expect(filteredBody.requests[0].id).toBe(olderBody.id);

    const detail = await getRequestRoute(new Request("http://localhost/api/requests/" + newerBody.id), {
      params: Promise.resolve({ id: newerBody.id }),
    });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.reference).toBe(newerBody.reference);
    expect(detailBody.notes).toEqual([]);

    const missing = await getRequestRoute(new Request("http://localhost/api/requests/missing"), {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000099" }),
    });
    expect(missing.status).toBe(404);

    const empty = await GET(new Request(`http://localhost/api/requests?q=${marker}-absent`));
    await expect(empty.json()).resolves.toMatchObject({ requests: [], total: 0 });
  });

  it("lets only one of two concurrent creates win for the same order item", async () => {
    const body = createBody();
    const [first, second] = await Promise.all([postRequest(body), postRequest(body)]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});
