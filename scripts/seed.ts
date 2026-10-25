import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { pathToFileURL } from "node:url";
import { buildSeedDataset } from "../src/lib/db/seed-data";
import { createPool } from "../src/lib/db/pool";
import { requestNotes, returnRequests } from "../src/lib/db/schema";
import { readEnv } from "../src/lib/env";

config({ path: ".env" });

export async function seed(connectionString: string) {
  const pool = createPool(connectionString);
  const db = drizzle(pool);
  const dataset = buildSeedDataset();

  try {
    await db.insert(returnRequests).values(dataset.requests).onConflictDoNothing({
      target: returnRequests.id,
    });
    await db.insert(requestNotes).values(dataset.notes).onConflictDoNothing({
      target: requestNotes.id,
    });
    await pool.query(`
      select setval(
        'return_request_ref_seq',
        (
          select coalesce(max(substring(reference from 9)::integer), 1)
          from return_requests
        )
      )
    `);

    const count = await pool.query<{ requests: number }>(
      "select count(*)::int as requests from return_requests",
    );

    return {
      requests: count.rows[0]?.requests ?? 0,
      insertedReferences: dataset.requests.length,
    };
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  seed(readEnv().databaseUrlUnpooled)
    .then((summary) => {
      console.log(`Seed complete. return_requests count=${summary.requests}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
