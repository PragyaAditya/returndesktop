import { Pool } from "pg";

export function poolMax(connectionString: string) {
  return connectionString.includes("-pooler") ? 1 : 10;
}

export function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    max: poolMax(connectionString),
    idleTimeoutMillis: 20_000,
  });
}
