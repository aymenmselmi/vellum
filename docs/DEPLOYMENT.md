# Deploying Vellum

The application needs a **Node.js process plus PostgreSQL**. GitHub stores the source and runs CI; pushing to GitHub does not publish a running website. GitHub Pages and static-only hosts cannot run this backend.

The `.openai/hosting.json` file belongs to an earlier static preview. Preserve it if maintaining that preview association, but do not use its static deployment configuration for the Node/PostgreSQL application.

## Environment settings

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Required | PostgreSQL connection URL; keep it private |
| `DATABASE_SSL` | `false` | Set `true` for a remote database requiring verified TLS |
| `HOST` | `127.0.0.1` | Use `0.0.0.0` when the hosting platform requires a public/container listener |
| `PORT` | `3000` | Use the port assigned by the host |
| `APP_ORIGIN` | `http://localhost:<PORT>` | Exact browser origin; production requires HTTPS, without trailing slash/path |
| `APP_TIMEZONE` | `Africa/Tunis` | Agency date boundary for reservation rules |
| `NODE_ENV` | Development when unset | Set `production` for Secure session cookies and production CSP behavior |
| `TRUST_PROXY` | `0` | Known number of trusted reverse-proxy hops; set only for your actual hosting topology |
| `ADMIN_EMAIL` | `admin@vellum.local` during seeding | Initial administrator email; use your chosen production address |
| `ADMIN_NAME` | `Vellum Admin` during seeding | Initial administrator display name |
| `ADMIN_PASSWORD` | Required for seeding | Strong initial password; not needed by the running server after seeding |
| `TEST_DATABASE_URL` | Optional in development | Separate database for tests; required if testing with `NODE_ENV=production` |
| `PG_BIN` | Native tools on PATH / Windows auto-detection | Local setup helper's PostgreSQL tools directory |
| `VELLUM_DB_PORT` | `55432` at first native setup | Optional custom port for a newly created local cluster |
| `POSTGRES_PASSWORD` | Required by Docker Compose | Docker database initialization password; match the connection URL |

Store production secrets in the hosting platform's environment/secret settings. Never put real values in `.env.example`, workflow files, or commits.

## Deployment sequence

1. Provision PostgreSQL and a dedicated application login/database.
2. Configure the required environment values on the Node host. Use an HTTPS `APP_ORIGIN` matching the public URL exactly.
3. Install the repository's locked production dependencies:

   ```sh
   npm ci --omit=dev
   ```

4. Apply migrations using a database role allowed to create/alter the schema and enable `btree_gist`:

   ```sh
   npm run db:migrate
   ```

5. On the first deployment, seed the initial administrator and illustrative cars:

   ```sh
   npm run db:seed
   ```

   This does not reset existing passwords or records. Review the sample cars/rates in the backoffice before offering real rentals. If `ADMIN_EMAIL` already belongs to a normal member, seeding fails rather than promoting that member automatically.

6. Start the HTTP process with the hosting platform's process manager:

   ```sh
   npm start
   ```

7. Verify `/api/health`, public browsing, administrator login, and a controlled reservation/cancellation.

Node serves `dist/` directly. Do not run a separate Python static server or deploy only frontend files. The same origin must serve the API and frontend unless you explicitly extend the code to support another topology.

## Operational limits

- Serve traffic over HTTPS. Production cookies are Secure and will not work over plain HTTP.
- Verify PostgreSQL certificates using your provider's trusted CA; the code does not disable certificate verification.
- Keep database backups and test restores. Use your provider's backup facilities for production operations.
- The built-in rate limiter stores counters in memory. Use a shared limiter store before scaling to multiple Node processes/instances.
- Sessions are already stored in PostgreSQL and can be used by multiple application instances.
- Use a more restricted runtime database login after migrations if your deployment separates migration and runtime permissions.
- Do not run test suites against production records. Use a separate `TEST_DATABASE_URL`; test fixtures create/drop their own schemas.

## Application scope

The implementation does not include online payment processing, email verification, password reset email flows, file uploads, or background notification jobs. Vehicle images are URL/local-asset references. Add the required operational features before depending on them in a real rental business.
