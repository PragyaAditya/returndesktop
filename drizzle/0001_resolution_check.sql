ALTER TABLE "return_requests" DROP CONSTRAINT "return_requests_resolution_consistent";--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_resolution_consistent" CHECK (
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
);
