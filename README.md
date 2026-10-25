# ReturnDesk

Returns desk for a small online store. Support agents will create return requests, review them, and record a resolution. Product rules live in [docs/PRD.md](docs/PRD.md).

This repository currently contains the application foundation only. Request storage, the API, and the working desk are not implemented yet.

## Prerequisites

- Node.js 22.20 or newer (`nvm use` reads `.nvmrc`)
- npm

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `DATABASE_URL` before database commands. Do not commit `.env`.

Create two databases (the second is only for tests):

```bash
createdb returndesk
createdb returndesk_test
npm run db:migrate
npm run db:seed
```

`db:migrate` and `db:seed` use `DATABASE_URL_UNPOOLED`. Run migrate against an empty database. The seed inserts 32 requests and is safe to run again: rows use fixed ids and `ON CONFLICT DO NOTHING`.

To migrate the test database before `npm run test:integration`:

```bash
DATABASE_URL=postgres://USER@localhost:5432/returndesk_test \
DATABASE_URL_UNPOOLED=postgres://USER@localhost:5432/returndesk_test \
npm run db:migrate
```

Integration tests also migrate `returndesk_test` themselves and refuse any other database name.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run db:migrate
npm run db:seed
npm run build
```

## API

Errors use `{ "error": { "code", "message", "details" } }`.

- `POST /api/requests` creates an `Open` request. The server sets the id, reference, timestamps, and status. A second live request for the same order reference and SKU returns `409` `DUPLICATE_LIVE_REQUEST`.
- `GET /api/requests` searches `q` across customer name, email, order reference, and request reference. Optional `status` and `reason`. `sort` is one of `createdAt`, `updatedAt`, `reference`, `customerName`, `status`, `reason`, `orderReference`. `direction` is `asc` or `desc`. `page` and `pageSize` (max 100) paginate in PostgreSQL and return `total`.
- `GET /api/requests/:id` returns one active request and its notes.

Malformed JSON is `400`. Invalid fields or query parameters are `422`. Missing requests are `404`.

## Decisions so far

- Next.js App Router, TypeScript, and Tailwind, started from the standard app template rather than an admin kit.
- PostgreSQL is reached with a pooled `DATABASE_URL` at runtime and a direct `DATABASE_URL_UNPOOLED` for migrations. Locally the two can be the same connection string. On Neon, migrations must use the non-pooler host.
- Order references and SKUs are trimmed and stored uppercase. Emails are trimmed and stored lowercase. The partial unique index `one_live_request_per_order_item` compares those stored values.
- Request references are `RD-YYYY-######`, issued by `return_request_ref_seq`, not by counting rows.
- Money is `numeric(12, 2)`.
- Notes and requests cannot be physically deleted. Notes cannot be updated. Removal is a `removed_at` timestamp allowed only for `Open` and `Rejected`.
- Environment variables are validated with Zod when read. The app does not connect to a database during the production build.
- List pages will use `page` and `pageSize` because the API contract asks for page numbers. That is offset pagination, chosen over keyset pagination so the desk can jump back to page 1 when a filter changes.
