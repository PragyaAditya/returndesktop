import { and, eq, isNull } from "drizzle-orm";
import { ApiError, notFound } from "@/lib/errors/api-error";
import { requestNotes, returnRequests } from "@/lib/db/schema";
import type {
  CreateRequestInput,
  ListQuery,
  NoteInput,
  TransitionInput,
  UpdateRequestInput,
} from "@/lib/validation/requests";
import { decideApproval, detailEditBlock, illegalTransitionMessage, removalBlock } from "./lifecycle";
import { normalizeIdentity } from "./normalize";
import { presentNote, presentRequest } from "./present";
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

export async function updateRequest(id: string, input: UpdateRequestInput) {
  try {
  const outcome = await withLockedRequest(id, async (current, tx) => {
    const blocked = detailEditBlock(current.status);
    if (blocked) {
      return { type: "locked" as const, message: blocked };
    }

    const normalized = normalizeIdentity({
      customerName: input.customerName ?? current.customerName,
      customerEmail: input.customerEmail ?? current.customerEmail,
      customerPhone: input.customerPhone ?? current.customerPhone,
      orderReference: input.orderReference ?? current.orderReference,
      itemName: input.itemName ?? current.itemName,
      itemSku: input.itemSku ?? current.itemSku,
    });

    const [updated] = await tx
      .update(returnRequests)
      .set({
        ...normalized,
        quantity: input.quantity ?? current.quantity,
        reason: input.reason ?? current.reason,
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
  if (outcome.type === "locked") {
    throw new ApiError(409, "LOCKED_DETAILS", outcome.message);
  }
  if (outcome.type === "conflict") {
    throw new ApiError(409, "CONFLICT", "The request changed before the edit was saved.");
  }

  return presentRequest(outcome.row, await listNotes(id));
  } catch (error) {
    if (isLiveRequestConflict(error)) {
      throw new ApiError(
        409,
        "DUPLICATE_LIVE_REQUEST",
        "A live request already exists for this order and item.",
      );
    }
    throw error;
  }
}

export async function addNote(id: string, input: NoteInput) {
  const outcome = await withLockedRequest(id, async (_current, tx) => {
    const [note] = await tx
      .insert(requestNotes)
      .values({
        requestId: id,
        body: input.body.trim(),
        authorLabel: input.authorLabel?.trim() ?? null,
      })
      .returning();

    if (!note) {
      throw new Error("Insert returned no note");
    }

    return note;
  });

  if (outcome === "missing") {
    throw notFound();
  }

  return presentNote(outcome);
}

export async function removeRequest(id: string) {
  const outcome = await withLockedRequest(id, async (current, tx) => {
    const blocked = removalBlock(current.status);
    if (blocked) {
      return { type: "blocked" as const, message: blocked };
    }

    const [updated] = await tx
      .update(returnRequests)
      .set({ removedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(returnRequests.id, id),
          eq(returnRequests.status, current.status),
          isNull(returnRequests.removedAt),
        ),
      )
      .returning({ id: returnRequests.id });

    if (!updated) {
      return { type: "conflict" as const };
    }

    return { type: "ok" as const };
  });

  if (outcome === "missing") {
    throw notFound();
  }
  if (outcome.type === "blocked") {
    throw new ApiError(409, "REMOVAL_NOT_ALLOWED", outcome.message);
  }
  if (outcome.type === "conflict") {
    throw new ApiError(409, "CONFLICT", "The request changed before it could be removed.");
  }
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
