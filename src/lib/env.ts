import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
});

export type AppEnv = {
  databaseUrl: string;
  databaseUrlUnpooled: string;
};

export function readEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  const parsed = envSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    DATABASE_URL_UNPOOLED: source.DATABASE_URL_UNPOOLED || undefined,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  return {
    databaseUrl: parsed.data.DATABASE_URL,
    databaseUrlUnpooled:
      parsed.data.DATABASE_URL_UNPOOLED ?? parsed.data.DATABASE_URL,
  };
}
