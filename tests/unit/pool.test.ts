import { describe, expect, it } from "vitest";
import { poolMax } from "@/lib/db/pool";

describe("poolMax", () => {
  it("keeps a small local pool and one client on the Neon pooler", () => {
    expect(poolMax("postgres://praveensingh@localhost:5432/returndesk")).toBe(10);
    expect(
      poolMax("postgres://user:pass@ep-example-pooler.us-east-1.aws.neon.tech/returndesk"),
    ).toBe(1);
  });
});
