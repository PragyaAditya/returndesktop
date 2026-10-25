# ReturnDesk

ReturnDesk is a returns desk for a small online store. An agent creates a request, moves it through review, records one resolution, adds notes, and completes or removes it when the rules allow. The product spec is [docs/PRD.md](docs/PRD.md). The short [PRD.md](PRD.md) at the repository root is the scoring rubric.

## Public URLs

There is no public deployment and no GitHub remote. `git remote -v` is empty. Vercel has no stored credentials here, and the Neon CLI is not installed, so production was not provisioned. The exact order for a later deploy is in [docs/deployment.md](docs/deployment.md). Deployment is unverified.

## Architecture

Next.js App Router and React render the desk. Route Handlers on the Node.js runtime expose the API. Zod validates HTTP input. Domain rules live in `src/server/requests` and are not reimplemented in the UI. Drizzle talks to PostgreSQL through `pg`. Money is `numeric(12,2)`. Request references are `RD-YYYY-######` from the sequence `return_request_ref_seq`, never from `count(*)`.

The UI is a queue at `/`, a create form at `/requests/new`, and a detail page at `/requests/[id]`. Search waits about 300ms and resets to page 1. The desktop layout is a table. At 375px the same rows are cards. A status badge always includes the status word.

## Schema

`return_requests` stores the customer, the order reference, the item, the quantity, the reason, the status, the resolution, the refund amount, and timestamps. `request_notes` stores append-only notes. `removed_at` is the only removal marker.

Important database constraints:

- `one_live_request_per_order_item` is a partial unique index on `(order_reference, item_sku)` where `removed_at` is null and status is not `Rejected` or `Completed`.
- `return_requests_resolution_consistent` requires an approved row to have exactly one legal resolution. `Refund` needs `refund_amount > 0`. `Replacement` and `Store Credit` need a null amount. The check uses `CASE … ELSE false` so a null resolution does not slip through.
- `return_requests_removal_status` allows `removed_at` only for `Open` and `Rejected`.
- Checks also require a positive quantity, the `RD-YYYY-######` reference shape, trimmed names, an uppercase order reference and SKU, and a lowercase email.
- List indexes cover active rows by created time, status, reason, and order reference. `pg_trgm` GIN indexes support search on name, email, order reference, and request reference.
- Triggers reject `DELETE` on requests and `UPDATE` or `DELETE` on notes. `TRUNCATE` bypasses those triggers.

Migrations are `drizzle/0000_init.sql` and `drizzle/0001_resolution_check.sql`.

## API

Every error body is `{ "error": { "code", "message", "details" } }`. Unexpected failures are logged on the server and returned as `500` `INTERNAL_ERROR` without a stack trace.

| Method and path | Success | Failure |
| --- | --- | --- |
| `GET /api/health` | `200` `{ "ok": true }` | `500` if PostgreSQL cannot be queried |
| `POST /api/requests` | `201` | `400` malformed JSON, `422` invalid fields, `409` `DUPLICATE_LIVE_REQUEST` |
| `GET /api/requests` | `200` `{ requests, page, pageSize, total }` | `422` `INVALID_QUERY` |
| `GET /api/requests/:id` | `200` with notes | `404` missing or removed |
| `PATCH /api/requests/:id` | `200` | `409` `LOCKED_DETAILS` or `DUPLICATE_LIVE_REQUEST`, `422` if the body tries to set status, resolution, amount, reference, or timestamps |
| `POST /api/requests/:id/transition` | `200` | `409` `INVALID_STATUS_TRANSITION`, `422` `INVALID_RESOLUTION` |
| `POST /api/requests/:id/notes` | `201` | `404` removed or missing, `422` empty note |
| `POST /api/requests/:id/remove` | `204` empty body | `409` `REMOVAL_NOT_ALLOWED` |

`GET /api/requests` accepts `q`, `status`, `reason`, `sort`, `direction`, `page`, and `pageSize` (1–100, default 20). Sort is an allowlist: `createdAt`, `updatedAt`, `reference`, `customerName`, `status`, `reason`, `orderReference`. Search, filters, sort, page, and the total count run in SQL and exclude removed rows. `q` is an escaped `ILIKE` pattern. Results tie-break on id.

## Where the five rules are enforced

- **Lifecycle.** `src/server/requests/lifecycle.ts` allows only `Open → In Review`, `In Review → Approved`, `In Review → Rejected`, and `Approved → Completed`. `Rejected` and `Completed` are terminal. `transitionRequest` locks the row with `SELECT … FOR UPDATE`, re-reads the status, and writes status, resolution, and amount together. A lost race returns `409` `CONFLICT`. PostgreSQL does not encode the transition graph itself.
- **Resolution.** Approval requires `Refund` with an amount greater than 0, or `Replacement` or `Store Credit` with a null amount. The server returns `422` `INVALID_RESOLUTION` for any other combination, and it rejects resolution fields on non-approval transitions. Amounts are parsed as cents, not floating point. The `return_requests_resolution_consistent` check is the database backstop for an approved row.
- **One live request per order and SKU.** The server normalizes the order reference and SKU (trim, then uppercase) and the email (trim, then lowercase) before insert. A unique violation on `one_live_request_per_order_item` becomes `409` `DUPLICATE_LIVE_REQUEST`. A new live request is allowed after the previous one is `Rejected` or `Completed`, whether or not it was removed.
- **Locked details.** Customer and item fields change only in `Open` and `In Review`. The PATCH schema cannot set status, resolution, amount, reference, or timestamps. Notes are append-only in every non-removed status. There is no note edit or delete route. PostgreSQL blocks note updates and deletes. It does not block a direct SQL update of a locked customer field.
- **Soft removal.** Only `Open` and `Rejected` can be removed. The server sets `removed_at` and never issues `DELETE`. Removed rows disappear from the normal list and detail and reject notes, edits, and transitions. The removal check and the delete trigger back this up in PostgreSQL.

## Local setup

Prerequisites: Node.js 22.20 or newer (`nvm use` reads `.nvmrc`) and PostgreSQL 14 or newer. This copy was run against local PostgreSQL 14.

```bash
npm install
npx playwright install chromium
cp .env.example .env
createdb returndesk
createdb returndesk_test
npm run db:migrate
npm run db:seed
npm run dev
```

Fill in `DATABASE_URL` before the database commands. Do not commit `.env`. `db:migrate` and `db:seed` use `DATABASE_URL_UNPOOLED`, which falls back to `DATABASE_URL` locally. Migrate an empty database. The seed inserts 32 requests and is safe to run again: rows use fixed ids and `ON CONFLICT DO NOTHING`, then the reference sequence is set from the highest suffix.

The queue shows 31 requests because one seeded `Open` request is already soft-removed. The 32 rows cover every status and every reason. Some rows have notes. A rejected `ORD-100` / `SKU-TEE-BLU` and a completed `ORD-101` / `SKU-MUG-12` sit beside later live requests for the same pairs. References are `RD-2026-000001` through `RD-2026-000032`.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime connection. On Neon this must be the pooled host (`-pooler`). The server then keeps one client per instance. |
| `DATABASE_URL_UNPOOLED` | Direct connection for migrations and seed. On Neon the host must not contain `-pooler`. |
| `DATABASE_URL_TEST` | Optional. Integration tests otherwise use the same host as `DATABASE_URL` and the database name `returndesk_test`. |

## Tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm test` runs Vitest unit and PostgreSQL integration tests against `returndesk_test` only. Those tests migrate that database. `npm run test:e2e` runs Playwright against `http://localhost:3210` and reuses a dev server if one is already there. The click-through covers create, search, filter, pagination, notes, edit, approve, reject, complete, remove, an API error, a network failure, and a 375px viewport.

On the last local run before this README: lint, typecheck, and `npm run build` succeeded; Vitest reported 33 passed tests; Playwright reported 5 passed tests. Those commands were not run on a second clean machine.

## Production

Follow [docs/deployment.md](docs/deployment.md). Do not treat this repository as deployed.

## Decisions

- Neon is the intended host because the product has no accounts and no row-level security. Supabase would add an unused auth surface. Local PostgreSQL stands in until a Neon project exists.
- The runtime driver stays `pg` on the Node.js runtime. Lifecycle updates need a transaction and `SELECT … FOR UPDATE`, which the Neon HTTP driver does not hold.
- List pages use `page` and `pageSize` because the API contract asks for page numbers. That is offset pagination, chosen so the desk can return to page 1 when a filter changes.
- The partial unique index compares the stored uppercase order reference and SKU. The application normalizes before insert so concurrent creates collide on the same key.

## Limitations

- No public URL. A reviewer cannot click through a hosted desk yet.
- No authentication, email, charts, inventory, or refund processing. Those are out of scope.
- The transition graph and locked customer fields are enforced in the server transaction, not by a Postgres trigger. A direct SQL client can still change those columns.
- Hours were not tracked, so this README does not estimate them.
