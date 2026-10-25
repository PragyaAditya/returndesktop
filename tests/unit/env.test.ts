import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";

describe("readEnv", () => {
  it("rejects a missing database url", () => {
    expect(() => readEnv({})).toThrow(/DATABASE_URL/);
  });

  it("uses the pooled url for the app and falls back to it for migrations", () => {
    const env = readEnv({ DATABASE_URL: "postgres://localhost/returndesk" });

    expect(env.databaseUrl).toBe("postgres://localhost/returndesk");
    expect(env.databaseUrlUnpooled).toBe("postgres://localhost/returndesk");
  });

  it("keeps a separate direct url for migrations", () => {
    const env = readEnv({
      DATABASE_URL: "postgres://pooler/returndesk",
      DATABASE_URL_UNPOOLED: "postgres://direct/returndesk",
    });

    expect(env.databaseUrl).toBe("postgres://pooler/returndesk");
    expect(env.databaseUrlUnpooled).toBe("postgres://direct/returndesk");
  });
});
