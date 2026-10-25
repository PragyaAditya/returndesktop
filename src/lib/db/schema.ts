import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Order references and SKUs are trimmed and stored uppercase.
 * Emails are trimmed and stored lowercase.
 * Those normalized values are what the partial unique index compares.
 */
export const returnRequestRefSeq = pgSequence("return_request_ref_seq");

export const requestStatus = pgEnum("request_status", [
  "Open",
  "In Review",
  "Approved",
  "Rejected",
  "Completed",
]);

export const requestReason = pgEnum("request_reason", [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
]);

export const requestResolution = pgEnum("request_resolution", [
  "Refund",
  "Replacement",
  "Store Credit",
]);

const resolutionConsistent = sql`
  case
    when status in ('Approved'::request_status, 'Completed'::request_status)
      and resolution = 'Refund'::request_resolution
      and refund_amount > 0
      then true
    when status in ('Approved'::request_status, 'Completed'::request_status)
      and resolution in ('Replacement'::request_resolution, 'Store Credit'::request_resolution)
      and refund_amount is null
      then true
    when status in ('Open'::request_status, 'In Review'::request_status, 'Rejected'::request_status)
      and resolution is null
      and refund_amount is null
      then true
    else false
  end
`;

export const returnRequests = pgTable(
  "return_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference")
      .notNull()
      .unique()
      .default(
        sql`'RD-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || lpad(nextval('return_request_ref_seq')::text, 6, '0')`,
      ),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    orderReference: text("order_reference").notNull(),
    itemName: text("item_name").notNull(),
    itemSku: text("item_sku").notNull(),
    quantity: integer("quantity").notNull(),
    reason: requestReason("reason").notNull(),
    status: requestStatus("status").notNull().default("Open"),
    resolution: requestResolution("resolution"),
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("return_requests_quantity_positive", sql`${table.quantity} > 0`),
    check("return_requests_reference_format", sql`${table.reference} ~ '^RD-[0-9]{4}-[0-9]{6}$'`),
    check("return_requests_customer_name_present", sql`char_length(btrim(${table.customerName})) > 0`),
    check("return_requests_email_normalized", sql`${table.customerEmail} = lower(btrim(${table.customerEmail})) and ${table.customerEmail} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`),
    check("return_requests_phone_present", sql`char_length(btrim(${table.customerPhone})) > 0`),
    check("return_requests_order_normalized", sql`${table.orderReference} = upper(btrim(${table.orderReference})) and char_length(${table.orderReference}) > 0`),
    check("return_requests_sku_normalized", sql`${table.itemSku} = upper(btrim(${table.itemSku})) and char_length(${table.itemSku}) > 0`),
    check("return_requests_item_name_present", sql`char_length(btrim(${table.itemName})) > 0`),
    check("return_requests_resolution_consistent", resolutionConsistent),
    check(
      "return_requests_removal_status",
      sql`${table.removedAt} is null or ${table.status} in ('Open'::request_status, 'Rejected'::request_status)`,
    ),
    uniqueIndex("one_live_request_per_order_item")
      .on(table.orderReference, table.itemSku)
      .where(
        sql`${table.removedAt} is null and ${table.status} not in ('Rejected'::request_status, 'Completed'::request_status)`,
      ),
    index("return_requests_active_created_idx")
      .on(table.createdAt.desc(), table.id)
      .where(sql`${table.removedAt} is null`),
    index("return_requests_active_status_created_idx")
      .on(table.status, table.createdAt.desc())
      .where(sql`${table.removedAt} is null`),
    index("return_requests_active_reason_created_idx")
      .on(table.reason, table.createdAt.desc())
      .where(sql`${table.removedAt} is null`),
    index("return_requests_active_order_idx")
      .on(table.orderReference)
      .where(sql`${table.removedAt} is null`),
    index("return_requests_customer_name_trgm")
      .using("gin", sql`${table.customerName} gin_trgm_ops`)
      .where(sql`${table.removedAt} is null`),
    index("return_requests_customer_email_trgm")
      .using("gin", sql`${table.customerEmail} gin_trgm_ops`)
      .where(sql`${table.removedAt} is null`),
    index("return_requests_order_reference_trgm")
      .using("gin", sql`${table.orderReference} gin_trgm_ops`)
      .where(sql`${table.removedAt} is null`),
    index("return_requests_reference_trgm")
      .using("gin", sql`${table.reference} gin_trgm_ops`)
      .where(sql`${table.removedAt} is null`),
  ],
);

export const requestNotes = pgTable(
  "request_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => returnRequests.id),
    body: text("body").notNull(),
    authorLabel: text("author_label"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("request_notes_body_present", sql`char_length(btrim(${table.body})) > 0`),
    index("request_notes_request_created_idx").on(table.requestId, table.createdAt, table.id),
  ],
);

export type ReturnRequest = typeof returnRequests.$inferSelect;
export type RequestNote = typeof requestNotes.$inferSelect;
