import { and, eq, isNull } from "drizzle-orm";
import { ApiError, notFound } from "@/lib/errors/api-error";
import { returnRequests } from "@/lib/db/schema";
import type { CreateRequestInput, ListQuery, TransitionInput } from "@/lib/validation/requests";
import { decideApproval, illegalTransitionMessage } from "./lifecycle";
import { normalizeIdentity } from "./normalize";
import { presentRequest } from "./present";
import {
  findActiveRequest,
  insertRequest,
  isLiveRequestConflict,
  listNotes,
  listRequests,
  withLockedRequest,
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

export async function transitionRequest(id: string, input: TransitionInput) {
  const outcome = await withLockedRequest(id, async (current, tx) => {
    const illegal = illegalTransitionMessage(current.status, input.status);
    if (illegal) {
      return { type: "illegal" as const, message: illegal };
    }

    if (input.status !== "Approved" && (input.resolution !== undefined || input.refundAmount !== undefined)) {
      return {
        type: "invalid" as const,
        message: "This transition does not accept a resolution.",
      };
    }

    let resolution = current.resolution;
    let refundAmount = current.refundAmount;

    if (input.status === "Approved") {
      const decision = decideApproval(input);
      if (!decision.ok) {
        return { type: "invalid" as const, message: decision.message };
      }
      resolution = decision.resolution;
      refundAmount = decision.refundAmount;
    }

    if (input.status === "In Review" || input.status === "Rejected") {
      resolution = null;
      refundAmount = null;
    }

    const [updated] = await tx
      .update(returnRequests)
      .set({
        status: input.status,
        resolution,
        refundAmount,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(returnRequests.id, id),
          eq(returnRequests.status, current.status),
          isNull(returnRequests.removedAt),
        ),
      )
      .returning();

    if (!updated) {
      return { type: "conflict" as const };
    }

    return { type: "ok" as const, row: updated };
  });

  if (outcome === "missing") {
    throw notFound();
  }

  if (outcome.type === "illegal") {
    throw new ApiError(409, "INVALID_STATUS_TRANSITION", outcome.message);
  }

  if (outcome.type === "invalid") {
    throw new ApiError(422, "INVALID_RESOLUTION", outcome.message);
  }

  if (outcome.type === "conflict") {
    throw new ApiError(409, "CONFLICT", "The request changed before the transition was saved.");
  }

  return presentRequest(outcome.row, await listNotes(id));
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
