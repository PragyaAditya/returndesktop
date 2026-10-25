import type { RequestNote, ReturnRequest } from "@/lib/db/schema";

export function presentNote(note: RequestNote) {
  return {
    id: note.id,
    body: note.body,
    authorLabel: note.authorLabel,
    createdAt: note.createdAt.toISOString(),
  };
}

export function presentRequest(request: ReturnRequest, notes?: RequestNote[]) {
  return {
    id: request.id,
    reference: request.reference,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    orderReference: request.orderReference,
    itemName: request.itemName,
    itemSku: request.itemSku,
    quantity: request.quantity,
    reason: request.reason,
    status: request.status,
    resolution: request.resolution,
    refundAmount: request.refundAmount,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    ...(notes ? { notes: notes.map(presentNote) } : {}),
  };
}
