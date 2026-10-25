# 1. Product Requirements Document (PRD)

## Product overview

**ReturnDesk** is a returns desk for a small online store. Support agents create return requests, review them, approve or reject them, choose a resolution, add notes, and complete or remove eligible requests.

## Goals

- Build with Next.js App Router, React, Node.js, Tailwind CSS, and PostgreSQL.
- Enforce all business rules on the server and use database constraints for critical invariants.
- Perform search, filtering, sorting, and pagination in PostgreSQL.
- Return consistent, useful API errors with appropriate HTTP status codes.
- Include migrations and a repeatable seed script with at least 30 requests.
- Deploy publicly with persistent PostgreSQL data.
- Maintain readable code, an accurate README, and meaningful Git history.

## Out of scope

No real refund processing, customer accounts, inventory management, shipping labels, email/SMS notifications, or complex role-based access control. A refund is a recorded resolution only.

## Request data

Each request contains:
- UUID primary key.
- Unique, automatically generated human-readable reference, e.g. `RD-2026-000123`.
- Customer name, email, phone.
- Order reference.
- Item name/description and SKU/item identifier.
- Positive integer quantity.
- Reason: `Damaged`, `Wrong Item`, `Size Issue`, `Not As Described`, `Changed Mind`.
- Status: `Open`, `In Review`, `Approved`, `Rejected`, `Completed`.
- Nullable resolution: `Refund`, `Replacement`, `Store Credit`.
- Nullable refund amount stored as PostgreSQL `NUMERIC`, never floating point.
- Creation/update timestamps and nullable soft-removal timestamp.
- Related append-only notes with body, timestamp, and optional author label.

New requests start as `Open`. The server generates IDs, references, timestamps, and initial status. The client cannot set these authoritative fields.

## Lifecycle

Only these transitions are allowed:

| Current status | Allowed next status |
|---|---|
| Open | In Review |
| In Review | Approved |
| In Review | Rejected |
| Approved | Completed |
| Rejected | None |
| Completed | None |

`Rejected` and `Completed` are terminal. Approval requires a resolution:
- `Refund`: amount must be greater than zero.
- `Replacement`: refund amount must be null/absent.
- `Store Credit`: refund amount must be null/absent.

Persist status, resolution, and refund amount atomically.

## Mandatory business rules

1. **Lifecycle:** reject every transition not in the table.
2. **Resolution:** approval requires a valid resolution. Refund requires a positive amount; non-refund resolutions must not record an amount.
3. **One live request per order/item:** only one request can exist for the same order reference + item identifier while its status is neither `Rejected` nor `Completed`. Enforce with a PostgreSQL partial unique index and handle concurrent attempts. Exclude soft-removed records from this index. A new request is allowed after the prior request is rejected or completed.
4. **Locked details:** customer and item details cannot be edited in `Approved`, `Rejected`, or `Completed`. For this implementation, generic detail edits are allowed only in `Open` and `In Review`. Notes remain appendable in every non-removed state.
5. **Soft removal:** only `Open` and `Rejected` can be removed. Never physically delete the request or its notes. Removed records disappear from normal list/detail endpoints and cannot be modified through normal endpoints.

## List requirements

- Search by customer name/email, order reference, or generated request reference.
- Filter by status and reason.
- Sort by allowlisted columns and direction.
- Server-side pagination and matching total count.
- All search/filter/sort/pagination must run in PostgreSQL.
- Combined filters must work together.
- Debounce UI search by approximately 300 ms.
- Reset page to 1 when search, filter, or sort changes.
- Exclude removed records.
- Provide loading, empty, and error states.

## Notes

Notes are append-only and returned chronologically, with a deterministic tie-breaker such as note ID. Do not implement note edit/delete endpoints. Removed requests cannot receive new notes through normal endpoints.

## API contract

Recommended endpoints:
- `GET /api/requests` — search/filter/sort/paginate.
- `POST /api/requests` — create.
- `GET /api/requests/:id` — detail and ordered notes.
- `PATCH /api/requests/:id` — edit permitted customer/item details only.
- `POST /api/requests/:id/transition` — lifecycle operation.
- `POST /api/requests/:id/notes` — append note.
- `POST /api/requests/:id/remove` — soft removal.

Recommended list query parameters: `q`, `status`, `reason`, `sort`, `direction`, `page`, `pageSize`. Allowlist sort fields; never interpolate arbitrary user-supplied SQL identifiers.

Consistent error body:
```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "A request cannot move directly from Open to Completed.",
    "details": null
  }
}
```

Suggested HTTP semantics:
- `200` successful read/update/action with a response body.
- `201` successful creation.
- `204` successful removal with no response body, if applied consistently.
- `400` malformed JSON or request syntax.
- `404` missing or normally inaccessible request/note.
- `409` duplicate live request, illegal transition, locked edit, or disallowed removal.
- `422` valid JSON but invalid field values/decision combination.
- `500` unexpected server failure only.

Do not return HTTP 200 with an embedded error, swallow errors, or return HTML errors from API endpoints.

## Recommended architecture

- Next.js App Router, TypeScript, Tailwind CSS.
- Next.js Route Handlers as the Node.js backend.
- PostgreSQL via Neon or Supabase.
- Drizzle ORM with explicit SQL where useful.
- Zod for input validation.
- Vitest for unit/integration tests and Playwright for end-to-end tests.
- Vercel for app hosting and a managed PostgreSQL provider.
- Use Node.js runtime for database-backed handlers.
- Keep route handlers thin; centralize validation, business rules, data access, and error mapping.
- Use transactions and row locks or conditional updates when operation validity depends on current state.
- Use a PostgreSQL sequence or similarly concurrency-safe method for references. Never generate references by counting rows.
- Use database constraints as a second line of defense, not just application checks.

Suggested structure (adapt as needed; do not create empty abstractions):
```text
returndesk/
├── docs/PRD.md
├── drizzle/migrations/
├── public/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── requests/new/page.tsx
│   │   ├── requests/[id]/page.tsx
│   │   └── api/requests/...
│   ├── components/
│   ├── features/requests/
│   ├── lib/db/
│   ├── lib/errors/
│   ├── lib/validation/
│   └── server/requests/
├── scripts/seed.ts
├── tests/unit/
├── tests/integration/
├── tests/e2e/
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Database requirements

`return_requests` should include all fields described above. Add checks for positive quantity, valid status/reason/resolution, and resolution/refund consistency. Add a unique constraint on `reference`. Add useful indexes for status/date, reason/date, order reference, customer search as appropriate, and note retrieval.

The partial unique index should conceptually be:
```sql
CREATE UNIQUE INDEX one_live_request_per_order_item
ON return_requests (order_reference, item_sku)
WHERE status NOT IN ('Rejected', 'Completed')
  AND removed_at IS NULL;
```
Adapt to actual enum types/schema. Decide and document how order references and SKUs are normalized for comparisons.

`request_notes` must have a foreign key to `return_requests`. Do not physically delete either table's records in normal application workflows.

## Seed data

Provide a command that works from a clean database and seeds at least 30 requests across every status and reason, multiple customers/orders, notes on some requests, and valid resolutions. It must be repeatable/idempotent and must respect the partial unique index.

## UI requirements

- Dashboard/list with title, create action, search, filters, sorting, status badges, pagination, and total count.
- Desktop table; at 375px use responsive cards or another layout without page-wide horizontal overflow.
- Detail page with request data, resolution, timestamps, ordered notes, note composer, and only legal actions.
- Creation/edit forms with labels and field-level validation.
- Approval UI with resolution selector and conditional refund amount.
- Confirmation for removal.
- Visible loading, empty, error, pending, and success states.
- Accessible labels, keyboard navigation, focus indicators, readable contrast, and status text that does not rely on color alone.
- Preserve user input when practical if a server action fails.

## Testing requirements

Unit tests: lifecycle transition map, resolution rules, edit/removal eligibility, request validation, query parameter validation.

PostgreSQL integration tests: create request, duplicate prevention, allowed creation after closure, every legal/illegal transition, approval validation, locked edits, note append-only behavior, soft removal, removed record invisibility, list query combinations, unique references, concurrent duplicate creation, concurrent conflicting transitions.

Playwright: create, search, filter, paginate, inspect, add note, edit, approve, reject, complete, remove, show API errors, mobile viewport.

Use a real PostgreSQL test database for database constraints and concurrency tests. Mock-only tests are insufficient for these cases.

## Definition of done

- Public GitHub repository and deployed public URL.
- Production database attached and seeded.
- Migrations build a database from empty.
- All five business rules enforced server-side.
- Server-side search/filter/sort/pagination.
- Consistent JSON errors and appropriate HTTP status codes.
- Responsive at 375px.
- Loading, empty, and error states work.
- Automated tests pass and production build succeeds.
- `.env.example` complete; real `.env` never committed.
- README setup works on a clean machine and documents decisions, assumptions, limitations, deployment, seed command, tests, and approximate hours spent.
- Git history shows meaningful progress.

---
