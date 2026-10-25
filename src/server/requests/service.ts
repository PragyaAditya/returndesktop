import { ApiError, notFound } from "@/lib/errors/api-error";
import type { CreateRequestInput, ListQuery } from "@/lib/validation/requests";
import { normalizeIdentity } from "./normalize";
import { presentRequest } from "./present";
import {
  findActiveRequest,
  insertRequest,
  isLiveRequestConflict,
  listNotes,
  listRequests,
} from "./repository";

export async function createRequest(input: CreateRequestInput) {
  const normalized = normalizeIdentity(input);

  try {
    const created = await insertRequest(normalized);
    return presentRequest(created, []);
  } catch (error) {
    if (isLiveRequestConflict(error)) {
      throw new ApiError(
        409,
        "DUPLICATE_LIVE_REQUEST",
        "A live request already exists for this order and item.",
        {
          orderReference: normalized.orderReference,
          itemSku: normalized.itemSku,
        },
      );
    }
    throw error;
  }
}

export async function getRequest(id: string) {
  const request = await findActiveRequest(id);
  if (!request) {
    throw notFound();
  }

  const notes = await listNotes(id);
  return presentRequest(request, notes);
}

export async function listRequestPage(query: ListQuery) {
  const { rows, total } = await listRequests(query);
  return {
    requests: rows.map((row) => presentRequest(row)),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}
