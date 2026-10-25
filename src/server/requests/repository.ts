import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requestNotes, returnRequests, type RequestNote, type ReturnRequest } from "@/lib/db/schema";
import type { ListQuery } from "@/lib/validation/requests";

const sortColumns = {
  createdAt: returnRequests.createdAt,
  updatedAt: returnRequests.updatedAt,
  reference: returnRequests.reference,
  customerName: returnRequests.customerName,
  status: returnRequests.status,
  reason: returnRequests.reason,
  orderReference: returnRequests.orderReference,
} as const;

function searchFilter(query: string): SQL {
  const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const escapeChar = "\\";
  return sql`(
    ${returnRequests.customerName} ilike ${pattern} escape ${escapeChar}
    or ${returnRequests.customerEmail} ilike ${pattern} escape ${escapeChar}
    or ${returnRequests.orderReference} ilike ${pattern} escape ${escapeChar}
    or ${returnRequests.reference} ilike ${pattern} escape ${escapeChar}
  )`;
}

function listWhere(query: ListQuery) {
  const filters: SQL[] = [isNull(returnRequests.removedAt)];
  if (query.q) {
    filters.push(searchFilter(query.q));
  }
  if (query.status) {
    filters.push(eq(returnRequests.status, query.status));
  }
  if (query.reason) {
    filters.push(eq(returnRequests.reason, query.reason));
  }
  return and(...filters);
}

export async function insertRequest(values: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderReference: string;
  itemName: string;
  itemSku: string;
  quantity: number;
  reason: (typeof returnRequests.$inferInsert)["reason"];
}): Promise<ReturnRequest> {
  const [row] = await getDb()
    .insert(returnRequests)
    .values({ ...values, status: "Open" })
    .returning();

  if (!row) {
    throw new Error("Insert returned no row");
  }

  return row;
}

export async function findActiveRequest(id: string): Promise<ReturnRequest | null> {
  const [row] = await getDb()
    .select()
    .from(returnRequests)
    .where(and(eq(returnRequests.id, id), isNull(returnRequests.removedAt)))
    .limit(1);

  return row ?? null;
}

export async function listNotes(requestId: string): Promise<RequestNote[]> {
  return getDb()
    .select()
    .from(requestNotes)
    .where(eq(requestNotes.requestId, requestId))
    .orderBy(asc(requestNotes.createdAt), asc(requestNotes.id));
}

export async function listRequests(query: ListQuery) {
  const where = listWhere(query);
  const column = sortColumns[query.sort];
  const direction = query.direction === "asc" ? asc : desc;
  const db = getDb();

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(returnRequests)
      .where(where)
      .orderBy(direction(column), direction(returnRequests.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(returnRequests).where(where),
  ]);

  return { rows, total: Number(totals[0]?.total ?? 0) };
}

function postgresError(error: unknown): { code?: string; constraint?: string } | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if ("code" in error && typeof error.code === "string") {
    return error as { code?: string; constraint?: string };
  }

  if ("cause" in error) {
    return postgresError(error.cause);
  }

  return null;
}

export function isLiveRequestConflict(error: unknown) {
  const cause = postgresError(error);
  return cause?.code === "23505" && cause.constraint === "one_live_request_per_order_item";
}
