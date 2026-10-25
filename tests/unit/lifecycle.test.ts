import { describe, expect, it } from "vitest";
import {
  REQUEST_STATUSES,
  decideApproval,
  detailEditBlock,
  illegalTransitionMessage,
  removalBlock,
} from "@/server/requests/lifecycle";

describe("lifecycle", () => {
  it("allows only the documented transitions", () => {
    expect(illegalTransitionMessage("Open", "In Review")).toBeNull();
    expect(illegalTransitionMessage("In Review", "Approved")).toBeNull();
    expect(illegalTransitionMessage("In Review", "Rejected")).toBeNull();
    expect(illegalTransitionMessage("Approved", "Completed")).toBeNull();

    for (const status of REQUEST_STATUSES) {
      for (const target of REQUEST_STATUSES) {
        const legal =
          (status === "Open" && target === "In Review") ||
          (status === "In Review" && (target === "Approved" || target === "Rejected")) ||
          (status === "Approved" && target === "Completed");
        expect(Boolean(illegalTransitionMessage(status, target))).toBe(!legal);
      }
    }
  });

  it("requires a positive refund amount and rejects amounts on other resolutions", () => {
    expect(decideApproval({ resolution: "Refund", refundAmount: "10.5" })).toEqual({
      ok: true,
      resolution: "Refund",
      refundAmount: "10.50",
    });
    expect(decideApproval({ resolution: "Refund" }).ok).toBe(false);
    expect(decideApproval({ resolution: "Refund", refundAmount: "0.00" }).ok).toBe(false);
    expect(decideApproval({ resolution: "Replacement" })).toMatchObject({
      ok: true,
      refundAmount: null,
    });
    expect(decideApproval({ resolution: "Store Credit", refundAmount: "5.00" }).ok).toBe(false);
    expect(decideApproval({}).ok).toBe(false);
  });

  it("allows detail edits only while open or in review, and removal only while open or rejected", () => {
    expect(detailEditBlock("Open")).toBeNull();
    expect(detailEditBlock("In Review")).toBeNull();
    expect(detailEditBlock("Approved")).toMatch(/Approved/);
    expect(detailEditBlock("Rejected")).toMatch(/Rejected/);
    expect(detailEditBlock("Completed")).toMatch(/Completed/);
    expect(removalBlock("Open")).toBeNull();
    expect(removalBlock("Rejected")).toBeNull();
    expect(removalBlock("In Review")).toMatch(/In Review/);
    expect(removalBlock("Approved")).toMatch(/Approved/);
    expect(removalBlock("Completed")).toMatch(/Completed/);
  });
});
