import { z } from "zod";
import { ApiError, invalidJson, invalidQuery, validationError } from "@/lib/errors/api-error";

export const REQUEST_STATUSES = ["Open", "In Review", "Approved", "Rejected", "Completed"] as const;
export const REQUEST_REASONS = [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
] as const;
export const REQUEST_RESOLUTIONS = ["Refund", "Replacement", "Store Credit"] as const;
export const SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "reference",
  "customerName",
  "status",
  "reason",
  "orderReference",
] as const;

const statusSchema = z.enum(REQUEST_STATUSES);
const reasonSchema = z.enum(REQUEST_REASONS);
const resolutionSchema = z.enum(REQUEST_RESOLUTIONS);

const fieldIssues = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

export function parseSchema<T>(schema: z.ZodType<T>, value: unknown, error: (details: unknown) => ApiError): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw error(fieldIssues(parsed.error));
  }
  return parsed.data;
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    throw invalidJson();
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw invalidJson();
  }
}

const requiredText = z.string().trim().min(1).max(200);

export const createRequestSchema = z.strictObject({
  customerName: requiredText,
  customerEmail: z.string().trim().email().max(320),
  customerPhone: z.string().trim().min(1).max(40),
  orderReference: z.string().trim().min(1).max(80),
  itemName: requiredText,
  itemSku: z.string().trim().min(1).max(80),
  quantity: z.number().int().positive(),
  reason: reasonSchema,
});

export const updateRequestSchema = z
  .strictObject({
    customerName: requiredText.optional(),
    customerEmail: z.string().trim().email().max(320).optional(),
    customerPhone: z.string().trim().min(1).max(40).optional(),
    orderReference: z.string().trim().min(1).max(80).optional(),
    itemName: requiredText.optional(),
    itemSku: z.string().trim().min(1).max(80).optional(),
    quantity: z.number().int().positive().optional(),
    reason: reasonSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Provide at least one field to update.",
  });

export const transitionSchema = z.strictObject({
  status: z.enum(["In Review", "Approved", "Rejected", "Completed"]),
  resolution: resolutionSchema.optional(),
  refundAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const noteSchema = z.strictObject({
  body: z.string().trim().min(1).max(2000),
  authorLabel: z.string().trim().min(1).max(80).optional(),
});

export const requestIdSchema = z.uuid();

const listQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(200).optional(),
  status: statusSchema.optional(),
  reason: reasonSchema.optional(),
  sort: z.enum(SORT_FIELDS).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;

export function parseCreateRequest(value: unknown) {
  return parseSchema(createRequestSchema, value, validationError);
}

export function parseUpdateRequest(value: unknown) {
  return parseSchema(updateRequestSchema, value, validationError);
}

export function parseTransition(value: unknown) {
  return parseSchema(transitionSchema, value, validationError);
}

export function parseNote(value: unknown) {
  return parseSchema(noteSchema, value, validationError);
}

export function parseRequestId(value: string) {
  return parseSchema(requestIdSchema, value, () => validationError([{ path: "id", message: "Invalid request id." }]));
}

export function parseListQuery(params: URLSearchParams): ListQuery {
  const raw: Record<string, string> = {};
  for (const key of ["q", "status", "reason", "sort", "direction", "page", "pageSize"] as const) {
    const value = params.get(key);
    if (value !== null && value !== "") {
      raw[key] = value;
    }
  }

  return parseSchema(listQuerySchema, raw, invalidQuery);
}
