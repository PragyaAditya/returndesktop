import { describe, expect, it, vi } from "vitest";
import { ApiError, notFound } from "@/lib/errors/api-error";
import { handle, toErrorResponse } from "@/lib/errors/response";

describe("API errors", () => {
  it("returns the shared error shape and status for a domain error", async () => {
    const response = toErrorResponse(notFound());
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Request not found.",
        details: null,
      },
    });
  });

  it("hides unexpected failures behind a sanitized 500", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = toErrorResponse(new Error("password=secret connection failed"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error.",
        details: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    errorLog.mockRestore();
  });

  it("maps a thrown conflict through the route handler wrapper", async () => {
    const response = await handle(async () => {
      throw new ApiError(409, "DUPLICATE_LIVE_REQUEST", "A live request already exists for this order item.", {
        orderReference: "ORD-100",
        itemSku: "SKU-TEE-BLU",
      });
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DUPLICATE_LIVE_REQUEST", details: { orderReference: "ORD-100" } },
    });
  });
});
