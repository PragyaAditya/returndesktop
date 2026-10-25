# Production deployment

Deployment is **unverified**. This environment has a local PostgreSQL database only. The Vercel CLI has no credentials (`vercel whoami` reports no existing credentials), and the Neon CLI is not installed. No production project was created, no migration was run against Neon, and there is no public URL.

## What production must use

- Vercel for the Next.js app, Node.js 22.x (see `engines` and `.nvmrc`). Leave Route Handlers on the Node.js runtime. Do not switch the project to Edge.
- Neon PostgreSQL. The app keeps `pg` because lifecycle updates run inside a transaction with `SELECT … FOR UPDATE`. The Neon HTTP driver cannot hold that transaction.
- `DATABASE_URL` is the **pooled** Neon string. Its hostname contains `-pooler`. The server opens one client per instance on that URL so serverless handlers do not exhaust the pooler.
- `DATABASE_URL_UNPOOLED` is the **direct** Neon string. Its hostname must not contain `-pooler`. Migrations and `npm run db:seed` read this variable.

## Order

1. Create a Neon project and database named `returndesk`.
2. Copy the pooled connection string and the direct connection string from the Neon dashboard. Do not commit them.
3. Create a Vercel project from this Git repository. In Project Settings, set the Node.js version to 22.x.
4. In Vercel, set Production environment variables:
   - `DATABASE_URL` = pooled Neon URL
   - `DATABASE_URL_UNPOOLED` = direct Neon URL
5. From a machine that has the direct URL, apply migrations before the first request that writes data:

   ```bash
   DATABASE_URL_UNPOOLED='postgres://USER:PASSWORD@ep-example.REGION.aws.neon.tech/returndesk?sslmode=require' \
     npm run db:migrate
   ```

6. Seed once. The seed is idempotent (`ON CONFLICT DO NOTHING` on fixed ids) and then aligns `return_request_ref_seq` with the highest `RD-YYYY-######` suffix:

   ```bash
   DATABASE_URL_UNPOOLED='postgres://USER:PASSWORD@ep-example.REGION.aws.neon.tech/returndesk?sslmode=require' \
     npm run db:seed
   ```

7. Deploy the app (`vercel --prod` after `vercel login`, or the Vercel dashboard).
8. Check the database through the health route. A live database returns `{"ok":true}`. A failure returns `500` with `{ "error": { "code": "INTERNAL_ERROR", "message": "Unexpected server error.", "details": null } }` and does not include the connection string.

   ```bash
   curl -sS "https://YOUR_DEPLOYMENT/api/health"
   ```

9. Create one request in the deployed UI, or with `POST /api/requests`.
10. Redeploy or restart the Vercel deployment.
11. Open that request again, or `GET /api/requests/:id`, and confirm the same reference is still there.

Replace `YOUR_DEPLOYMENT` with the hostname Vercel prints. Do not invent it. Do not point `db:migrate` or `db:seed` at the pooler host.
