import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { seed } from "../../scripts/seed";

config({ path: ".env" });

function testDatabaseUrl() {
  if (process.env.DATABASE_URL_TEST) {
    return process.env.DATABASE_URL_TEST;
  }

  const appUrl = process.env.DATABASE_URL;
  if (!appUrl) {
    throw new Error("DATABASE_URL or DATABASE_URL_TEST is required");
  }

  const url = new URL(appUrl);
  url.pathname = "/returndesk_test";
  return url.toString();
}

const databaseUrl = testDatabaseUrl();

if (!new URL(databaseUrl).pathname.endsWith("/returndesk_test")) {
  throw new Error("Refusing to run schema tests outside returndesk_test");
}

const pool = new Pool({ connectionString: databaseUrl, max: 4 });

beforeAll(async () => {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
  await pool.end();
});

async function withRollback(run: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

function codeOf(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
}

async function insertRequest(
  client: PoolClient,
  overrides: Record<string, unknown> = {},
) {
  const row = {
    customer_name: "Test Customer",
    customer_email: "test.customer@example.com",
    customer_phone: "555-0199",
    order_reference: "ORD-TEST-1",
    item_name: "Test item",
    item_sku: "SKU-TEST-1",
    quantity: 1,
    reason: "Damaged",
    status: "Open",
    resolution: null,
    refund_amount: null,
    removed_at: null,
    ...overrides,
  };

  await client.query(
    `insert into return_requests (
      customer_name, customer_email, customer_phone, order_reference, item_name, item_sku,
      quantity, reason, status, resolution, refund_amount, removed_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      row.customer_name,
      row.customer_email,
      row.customer_phone,
      row.order_reference,
      row.item_name,
      row.item_sku,
      row.quantity,
      row.reason,
      row.status,
      row.resolution,
      row.refund_amount,
      row.removed_at,
    ],
  );
}

describe("return request schema", () => {
  it("seeds twice without duplicating rows and covers every status and reason", async () => {
    await seed(databaseUrl);
    const first = await pool.query<{ count: number }>("select count(*)::int as count from return_requests");
    await seed(databaseUrl);
    const second = await pool.query<{ count: number }>("select count(*)::int as count from return_requests");
    const statuses = await pool.query<{ count: number }>(
      "select count(distinct status)::int as count from return_requests",
    );
    const reasons = await pool.query<{ count: number }>(
      "select count(distinct reason)::int as count from return_requests",
    );
    const notes = await pool.query<{ count: number }>("select count(*)::int as count from request_notes");

    expect(first.rows[0]?.count).toBeGreaterThanOrEqual(30);
    expect(second.rows[0]?.count).toBe(first.rows[0]?.count);
    expect(statuses.rows[0]?.count).toBe(5);
    expect(reasons.rows[0]?.count).toBe(5);
    expect(notes.rows[0]?.count).toBeGreaterThan(0);
  });

  it("rejects invalid rows and blocks physical deletes", async () => {
    await withRollback(async (client) => {
      await expect(insertRequest(client, { quantity: 0 })).rejects.toSatisfy(
        (error: unknown) => codeOf(error) === "23514",
      );
    });

    await withRollback(async (client) => {
      await expect(
        insertRequest(client, { status: "Approved", resolution: null, refund_amount: null }),
      ).rejects.toSatisfy((error: unknown) => codeOf(error) === "23514");
    });

    await withRollback(async (client) => {
      await expect(
        insertRequest(client, {
          status: "Approved",
          resolution: "Replacement",
          refund_amount: "10.00",
        }),
      ).rejects.toSatisfy((error: unknown) => codeOf(error) === "23514");
    });

    await withRollback(async (client) => {
      await expect(
        insertRequest(client, {
          status: "Completed",
          resolution: "Refund",
          refund_amount: "0.00",
          removed_at: new Date(),
        }),
      ).rejects.toSatisfy((error: unknown) => codeOf(error) === "23514");
    });

    await withRollback(async (client) => {
      await insertRequest(client, { order_reference: "ORD-LIVE", item_sku: "SKU-LIVE" });
      await expect(
        insertRequest(client, { order_reference: "ORD-LIVE", item_sku: "SKU-LIVE" }),
      ).rejects.toSatisfy((error: unknown) => codeOf(error) === "23505");
    });

    await withRollback(async (client) => {
      await insertRequest(client, {
        order_reference: "ORD-DONE",
        item_sku: "SKU-DONE",
        status: "Rejected",
      });
      await expect(
        insertRequest(client, {
          order_reference: "ORD-DONE",
          item_sku: "SKU-DONE",
          status: "Open",
        }),
      ).resolves.toBeUndefined();
    });

    await withRollback(async (client) => {
      await insertRequest(client, { order_reference: "ORD-DEL", item_sku: "SKU-DEL" });
      await expect(
        client.query("delete from return_requests where order_reference = 'ORD-DEL'"),
      ).rejects.toSatisfy((error: unknown) => codeOf(error) === "P0001");
    });

    await withRollback(async (client) => {
      await insertRequest(client, { order_reference: "ORD-NOTE", item_sku: "SKU-NOTE" });
      const inserted = await client.query<{ id: string }>(
        "select id from return_requests where order_reference = 'ORD-NOTE'",
      );
      await client.query("insert into request_notes (request_id, body) values ($1, $2)", [
        inserted.rows[0]?.id,
        "Keep this note",
      ]);
      await expect(
        client.query("update request_notes set body = 'changed' where request_id = $1", [
          inserted.rows[0]?.id,
        ]),
      ).rejects.toSatisfy((error: unknown) => codeOf(error) === "P0001");
    });
  });

  it("generates a unique human-readable reference from the sequence", async () => {
    await withRollback(async (client) => {
      await insertRequest(client, { order_reference: "ORD-REF", item_sku: "SKU-REF" });
      const result = await client.query<{ reference: string }>(
        "select reference from return_requests where order_reference = 'ORD-REF'",
      );
      expect(result.rows[0]?.reference).toMatch(/^RD-\d{4}-\d{6}$/);
    });
  });
});
