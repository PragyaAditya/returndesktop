import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/requests/[id]/route";
import { POST as transition } from "@/app/api/requests/[id]/transition/route";
import { GET, POST } from "@/app/api/requests/route";
import { closeDb } from "@/lib/db/client";

config({ path: ".env" });

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/returndesk");
  url.pathname = "/returndesk_test";
  process.env.DATABASE_URL = url.toString();
  await closeDb();
});

afterAll(async () => {
  await closeDb();
});

describe("direct API negatives", () => {
  it("rejects bad paging, unknown ids, and status changes through PATCH", async () => {
    const paging = await GET(new Request("http://localhost/api/requests?page=0"));
    expect(paging.status).toBe(422);
    await expect(paging.json()).resolves.toMatchObject({ error: { code: "INVALID_QUERY" } });

    const missing = await transition(
      new Request("http://localhost/api/requests/missing/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "In Review" }),
      }),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000009999" }) },
    );
    expect(missing.status).toBe(404);

    const created = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: "Negative Path",
          customerEmail: "negative.path@example.com",
          customerPhone: "555-0111",
          orderReference: `ord-neg-${crypto.randomUUID()}`,
          itemName: "Mug",
          itemSku: `sku-neg-${crypto.randomUUID()}`,
          quantity: 1,
          reason: "Damaged",
        }),
      }),
    );
    const body = await created.json();
    const patched = await PATCH(
      new Request("http://localhost/api/requests/" + body.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Completed", reference: "RD-1999-000001" }),
      }),
      { params: Promise.resolve({ id: body.id }) },
    );
    expect(patched.status).toBe(422);
  });
});
