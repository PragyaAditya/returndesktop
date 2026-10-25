import { describe, expect, it } from "vitest";
import { ApiError, invalidJson } from "@/lib/errors/api-error";
import {
  parseCreateRequest,
  parseListQuery,
  parseRequestId,
  parseTransition,
  readJson,
} from "@/lib/validation/requests";

describe("request validation", () => {
  it("rejects malformed JSON with 400", async () => {
    const request = new Request("http://localhost/api/requests", {
      method: "POST",
      body: "{",
    });

    await expect(readJson(request)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JSON",
    } satisfies Partial<ApiError>);
    expect(invalidJson().status).toBe(400);
  });

  it("rejects unknown create fields and invalid values with 422", () => {
    expect(() =>
      parseCreateRequest({
        customerName: "Amina Shah",
        customerEmail: "not-an-email",
        customerPhone: "555-0101",
        orderReference: "ord-1",
        itemName: "Mug",
        itemSku: "sku-1",
        quantity: 0,
        reason: "Damaged",
        status: "Approved",
      }),
    ).toThrow(ApiError);

    try {
      parseCreateRequest({
        customerName: "Amina Shah",
        customerEmail: "not-an-email",
        customerPhone: "555-0101",
        orderReference: "ord-1",
        itemName: "Mug",
        itemSku: "sku-1",
        quantity: 1,
        reason: "Damaged",
        status: "Approved",
      });
    } catch (error) {
      expect(error).toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    }
  });

  it("accepts a create body without authoritative fields", () => {
    expect(
      parseCreateRequest({
        customerName: " Amina Shah ",
        customerEmail: "amina.shah@example.com",
        customerPhone: "555-0101",
        orderReference: "ord-1",
        itemName: "Mug",
        itemSku: "sku-1",
        quantity: 2,
        reason: "Damaged",
      }),
    ).toMatchObject({ customerName: "Amina Shah", quantity: 2 });
  });

  it("rejects a bad sort field and defaults paging", () => {
    const params = new URLSearchParams("sort=password&direction=desc");
    expect(() => parseListQuery(params)).toThrow(expect.objectContaining({ status: 422, code: "INVALID_QUERY" }));

    expect(parseListQuery(new URLSearchParams())).toEqual({
      sort: "createdAt",
      direction: "desc",
      page: 1,
      pageSize: 20,
    });
  });

  it("rejects an id that is not a uuid and a transition with a bad status", () => {
    expect(() => parseRequestId("12")).toThrow(expect.objectContaining({ status: 422 }));
    expect(() => parseTransition({ status: "Open" })).toThrow(expect.objectContaining({ status: 422 }));
    expect(parseTransition({ status: "In Review" })).toEqual({ status: "In Review" });
  });
});
