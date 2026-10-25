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

Fill in `DATABASE_URL` before later database commands. Do not commit `.env`.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Decisions so far

- Next.js App Router, TypeScript, and Tailwind, started from the standard app template rather than an admin kit.
- PostgreSQL will be reached with a pooled `DATABASE_URL` at runtime and a direct `DATABASE_URL_UNPOOLED` for migrations. Locally the two can be the same connection string.
- Environment variables are validated with Zod when read. The app does not connect to a database during the production build.
