import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readHealth } from "@/app/api/health/route";
import { closeDb } from "@/lib/db/client";

config({ path: ".env" });

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "postgres://localhost/returndesk");
  if (!process.env.DATABASE_URL_TEST) {
    url.pathname = "/returndesk_test";
  }
  if (!url.pathname.endsWith("/returndesk_test")) {
    throw new Error("Refusing to run health tests outside returndesk_test");
  }
  process.env.DATABASE_URL = url.toString();
  await closeDb();
});

afterAll(async () => {
  await closeDb();
});

describe("health check", () => {
  it("reports ok when PostgreSQL accepts a query", async () => {
    await expect(readHealth()).resolves.toEqual({ ok: true });
  });
});
