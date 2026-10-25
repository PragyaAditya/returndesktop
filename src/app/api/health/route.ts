import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { handle } from "@/lib/errors/response";

export async function readHealth() {
  await getDb().execute(sql`select 1`);
  return { ok: true as const };
}

export async function GET() {
  await connection();
  return handle(async () => Response.json(await readHealth()));
}
