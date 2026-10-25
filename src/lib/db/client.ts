import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { readEnv } from "@/lib/env";
import * as schema from "./schema";
import { createPool } from "./pool";

const globalForDb = globalThis as unknown as {
  returnDeskPool?: ReturnType<typeof createPool>;
};

export function getDb() {
  if (!globalForDb.returnDeskPool) {
    globalForDb.returnDeskPool = createPool(readEnv().databaseUrl);
  }

  return drizzle(globalForDb.returnDeskPool, { schema });
}

export async function closeDb() {
  await globalForDb.returnDeskPool?.end();
  globalForDb.returnDeskPool = undefined;
}
