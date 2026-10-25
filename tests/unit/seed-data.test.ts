import { describe, expect, it } from "vitest";
import { SEED_REASONS, buildSeedDataset } from "@/lib/db/seed-data";

const LIVE = new Set(["Open", "In Review", "Approved"]);

describe("buildSeedDataset", () => {
  const dataset = buildSeedDataset();

  it("covers at least 30 requests, every status, and every reason", () => {
    expect(dataset.requests.length).toBeGreaterThanOrEqual(30);
    expect(new Set(dataset.requests.map((request) => request.status))).toEqual(
      new Set(["Open", "In Review", "Approved", "Rejected", "Completed"]),
    );
    expect(new Set(dataset.requests.map((request) => request.reason))).toEqual(new Set(SEED_REASONS));
    expect(dataset.notes.length).toBeGreaterThan(0);
  });

  it("keeps only one live request per order and sku, ignoring removed rows", () => {
    const liveKeys = new Set<string>();

    for (const request of dataset.requests) {
      if (request.removedAt || !LIVE.has(request.status)) {
        continue;
      }
      const key = `${request.orderReference}::${request.itemSku}`;
      expect(liveKeys.has(key)).toBe(false);
      liveKeys.add(key);
    }
  });

  it("pairs resolutions with refund amounts the database will accept", () => {
    for (const request of dataset.requests) {
      if (request.status === "Approved" || request.status === "Completed") {
        expect(request.resolution).not.toBeNull();
        if (request.resolution === "Refund") {
          expect(Number(request.refundAmount)).toBeGreaterThan(0);
        } else {
          expect(request.refundAmount).toBeNull();
        }
      } else {
        expect(request.resolution).toBeNull();
        expect(request.refundAmount).toBeNull();
      }

      if (request.removedAt) {
        expect(["Open", "Rejected"]).toContain(request.status);
      }
    }
  });
});
