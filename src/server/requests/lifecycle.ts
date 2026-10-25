export const REQUEST_STATUSES = ["Open", "In Review", "Approved", "Rejected", "Completed"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const transitions: Record<RequestStatus, readonly RequestStatus[]> = {
  Open: ["In Review"],
  "In Review": ["Approved", "Rejected"],
  Approved: ["Completed"],
  Rejected: [],
  Completed: [],
};

export function detailEditBlock(status: RequestStatus) {
  if (status === "Open" || status === "In Review") {
    return null;
  }

  return `Customer and item details cannot be edited while the request is ${status}.`;
}

export function removalBlock(status: RequestStatus) {
  if (status === "Open" || status === "Rejected") {
    return null;
  }

  return `A ${status} request cannot be removed.`;
}

export function allowedTransitions(status: RequestStatus) {
  return transitions[status];
}

export function illegalTransitionMessage(from: RequestStatus, to: RequestStatus) {
  if (transitions[from].includes(to)) {
    return null;
  }

  return `A request cannot move directly from ${from} to ${to}.`;
}

export function parseRefundAmount(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    return null;
  }

  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null;
  }

  const whole = match[1].replace(/^0+(?=\d)/, "") || "0";
  return `${whole}.${(match[2] ?? "").padEnd(2, "0")}`;
}

export type ResolutionDecision =
  | { ok: true; resolution: "Refund"; refundAmount: string }
  | { ok: true; resolution: "Replacement" | "Store Credit"; refundAmount: null }
  | { ok: false; message: string };

export function decideApproval(input: {
  resolution?: "Refund" | "Replacement" | "Store Credit";
  refundAmount?: string;
}): ResolutionDecision {
  if (!input.resolution) {
    return { ok: false, message: "Approval requires a resolution." };
  }

  if (input.resolution === "Refund") {
    const refundAmount = parseRefundAmount(input.refundAmount);
    if (!refundAmount) {
      return { ok: false, message: "A refund requires an amount greater than zero." };
    }
    return { ok: true, resolution: "Refund", refundAmount };
  }

  if (input.refundAmount !== undefined) {
    return { ok: false, message: "Only a refund can record an amount." };
  }

  return { ok: true, resolution: input.resolution, refundAmount: null };
}
