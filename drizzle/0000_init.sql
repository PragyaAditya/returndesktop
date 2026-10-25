CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."request_reason" AS ENUM('Damaged', 'Wrong Item', 'Size Issue', 'Not As Described', 'Changed Mind');--> statement-breakpoint
CREATE TYPE "public"."request_resolution" AS ENUM('Refund', 'Replacement', 'Store Credit');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('Open', 'In Review', 'Approved', 'Rejected', 'Completed');--> statement-breakpoint
CREATE SEQUENCE "public"."return_request_ref_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "request_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_notes_body_present" CHECK (char_length(btrim("request_notes"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text DEFAULT 'RD-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || lpad(nextval('return_request_ref_seq')::text, 6, '0') NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"order_reference" text NOT NULL,
	"item_name" text NOT NULL,
	"item_sku" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" "request_reason" NOT NULL,
	"status" "request_status" DEFAULT 'Open' NOT NULL,
	"resolution" "request_resolution",
	"refund_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "return_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "return_requests_quantity_positive" CHECK ("return_requests"."quantity" > 0),
	CONSTRAINT "return_requests_reference_format" CHECK ("return_requests"."reference" ~ '^RD-[0-9]{4}-[0-9]{6}$'),
	CONSTRAINT "return_requests_customer_name_present" CHECK (char_length(btrim("return_requests"."customer_name")) > 0),
	CONSTRAINT "return_requests_email_normalized" CHECK ("return_requests"."customer_email" = lower(btrim("return_requests"."customer_email")) and "return_requests"."customer_email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
	CONSTRAINT "return_requests_phone_present" CHECK (char_length(btrim("return_requests"."customer_phone")) > 0),
	CONSTRAINT "return_requests_order_normalized" CHECK ("return_requests"."order_reference" = upper(btrim("return_requests"."order_reference")) and char_length("return_requests"."order_reference") > 0),
	CONSTRAINT "return_requests_sku_normalized" CHECK ("return_requests"."item_sku" = upper(btrim("return_requests"."item_sku")) and char_length("return_requests"."item_sku") > 0),
	CONSTRAINT "return_requests_item_name_present" CHECK (char_length(btrim("return_requests"."item_name")) > 0),
	CONSTRAINT "return_requests_resolution_consistent" CHECK (
  (
    status in ('Approved'::request_status, 'Completed'::request_status)
    and (
      (resolution = 'Refund'::request_resolution and refund_amount > 0)
      or (
        resolution in ('Replacement'::request_resolution, 'Store Credit'::request_resolution)
        and refund_amount is null
      )
    )
  )
  or (
    status not in ('Approved'::request_status, 'Completed'::request_status)
    and resolution is null
    and refund_amount is null
  )
),
	CONSTRAINT "return_requests_removal_status" CHECK ("return_requests"."removed_at" is null or "return_requests"."status" in ('Open'::request_status, 'Rejected'::request_status))
);
--> statement-breakpoint
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_notes_request_created_idx" ON "request_notes" USING btree ("request_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_live_request_per_order_item" ON "return_requests" USING btree ("order_reference","item_sku") WHERE "return_requests"."removed_at" is null and "return_requests"."status" not in ('Rejected'::request_status, 'Completed'::request_status);--> statement-breakpoint
CREATE INDEX "return_requests_active_created_idx" ON "return_requests" USING btree ("created_at" DESC NULLS LAST,"id") WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_active_status_created_idx" ON "return_requests" USING btree ("status","created_at" DESC NULLS LAST) WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_active_reason_created_idx" ON "return_requests" USING btree ("reason","created_at" DESC NULLS LAST) WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_active_order_idx" ON "return_requests" USING btree ("order_reference") WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_customer_name_trgm" ON "return_requests" USING gin ("customer_name" gin_trgm_ops) WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_customer_email_trgm" ON "return_requests" USING gin ("customer_email" gin_trgm_ops) WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_order_reference_trgm" ON "return_requests" USING gin ("order_reference" gin_trgm_ops) WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "return_requests_reference_trgm" ON "return_requests" USING gin ("reference" gin_trgm_ops) WHERE "return_requests"."removed_at" is null;--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_note_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'request notes are append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER request_notes_no_update
BEFORE UPDATE ON request_notes
FOR EACH ROW EXECUTE FUNCTION reject_note_mutation();--> statement-breakpoint
CREATE TRIGGER request_notes_no_delete
BEFORE DELETE ON request_notes
FOR EACH ROW EXECUTE FUNCTION reject_note_mutation();--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_request_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'return requests cannot be physically deleted';
END;
$$;--> statement-breakpoint
CREATE TRIGGER return_requests_no_delete
BEFORE DELETE ON return_requests
FOR EACH ROW EXECUTE FUNCTION reject_request_delete();