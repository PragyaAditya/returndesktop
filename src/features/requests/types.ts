export const STATUSES = ["Open", "In Review", "Approved", "Rejected", "Completed"] as const;
export const REASONS = ["Damaged", "Wrong Item", "Size Issue", "Not As Described", "Changed Mind"] as const;
export const RESOLUTIONS = ["Refund", "Replacement", "Store Credit"] as const;

export type RequestStatus = (typeof STATUSES)[number];
export type RequestReason = (typeof REASONS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

export type Note = {
  id: string;
  body: string;
  authorLabel: string | null;
  createdAt: string;
};

export type ReturnRequest = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderReference: string;
  itemName: string;
  itemSku: string;
  quantity: number;
  reason: RequestReason;
  status: RequestStatus;
  resolution: Resolution | null;
  refundAmount: string | null;
  createdAt: string;
  updatedAt: string;
  notes?: Note[];
};

export type RequestList = {
  requests: ReturnRequest[];
  page: number;
  pageSize: number;
  total: number;
};

export type RequestDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderReference: string;
  itemName: string;
  itemSku: string;
  quantity: string;
  reason: RequestReason | "";
};

export function emptyDraft(): RequestDraft {
  return {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    orderReference: "",
    itemName: "",
    itemSku: "",
    quantity: "1",
    reason: "",
  };
}

export function draftFromRequest(request: ReturnRequest): RequestDraft {
  return {
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    orderReference: request.orderReference,
    itemName: request.itemName,
    itemSku: request.itemSku,
    quantity: String(request.quantity),
    reason: request.reason,
  };
}
