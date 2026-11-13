# Vellum

A French-language car rental platform with a member website and an administrator backoffice. Built with **Node.js, Express, PostgreSQL, HTML, CSS, and vanilla JavaScript**.

One Node process serves both the frontend and the API. PostgreSQL stores the accounts, sessions, vehicles, and reservations. There is no frontend build step.

## Features

- **Members:** sign up, sign in, browse cars, filter by agency/category/dates, sort by price, reserve a car, and manage upcoming rentals.
- **Administrators:** add/edit/remove vehicles, cancel rental orders, and suspend/reactivate/delete members.
- **Bookings:** server-calculated prices, rental snapshots, exclusive return dates, and protection against overlapping reservations at the database level.
- **Accounts:** server-side scrypt password hashing, database-backed sessions, HttpOnly cookies, CSRF/origin checks, input validation, and login rate limits.
- **Interface:** responsive layouts, French copy and error messages, and French date/number formatting.

## Quick start on another computer

Install [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download) **22.18 or newer**, and [PostgreSQL](https://www.postgresql.org/download/) **18 with its command-line tools**. The native setup was verified on Windows with Node 22.18 and PostgreSQL 18.1.

```sh
git clone https://github.com/aymenmselmi/vellum.git
cd vellum
npm ci
npm run setup
npm start
```

In Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is restricted.

Open **http://localhost:3000**. The setup helper creates a separate project PostgreSQL instance on **127.0.0.1:55432**, generates a private `.env`, applies migrations, and creates six sample cars plus an administrator account.

**Administrator:** select **Administration** in the footer. Use the generated `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your local `.env`. Members register through **Connexion → Créer un compte**.

Do not copy `.env` or `.local/` from another computer. Each installation generates its own credentials and database. Existing custom cars, members, and reservations are not transferred by Git; see the [database transfer guide](docs/DATABASE.md) if you need them.

For PostgreSQL installed elsewhere, set `PG_BIN` to the directory containing `initdb` and `pg_ctl`. On macOS/Linux, those tools must be on `PATH` or configured through `PG_BIN`, and setup must run as a normal user.

**Detailed alternatives and troubleshooting:** [Windows/macOS/Linux setup, Docker, or an existing PostgreSQL server](docs/SETUP.md).

## Daily commands

Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the versions in `package-lock.json` |
| `npm run setup` | Create/start the native local database, migrate, and seed |
| `npm run db:start` | Start the native project database after shutdown/reboot |
| `npm start` | Serve the website and API on port 3000 |
| `npm run dev` | Start Node with automatic server restarts |
| `npm run db:stop` | Stop the native project database, preserving its data |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Create initial sample cars/admin without resetting existing data |
| `npm test` | Run API integration tests against PostgreSQL |
| `npm run test:db` | Run direct SQL/database integration tests |
| `npm run test:ui` | Run browser integration tests |

After restarting the computer, use `npm run db:start`, then `npm start` for native mode. The optional Docker database uses `docker compose up -d --wait database` instead of `db:start`. Stop the Node process with **Ctrl+C**.

Changing `ADMIN_PASSWORD` in `.env` after the account has been created does not reset that account's stored password.

## Documentation

| Guide | Contents |
| --- | --- |
| [Setup](docs/SETUP.md) | Fresh clone, prerequisites, Windows/macOS/Linux, Docker, pgAdmin, common errors |
| [Database](docs/DATABASE.md) | Schema, migration rules, PostgreSQL inspection, private backups and transfer |
| [API](docs/API.md) | Routes, authentication, CSRF, JSON bodies, errors, supported car fields |
| [Architecture](docs/ARCHITECTURE.md) | Backend/frontend modules, booking rules, tests, and development workflow |
| [Deployment](docs/DEPLOYMENT.md) | Node/PostgreSQL hosting and production configuration |

## Project structure

```text
dist/                   Maintained frontend source: HTML, CSS, JS modules, local images
server/
  index.js              Server startup and shutdown
  app.js                Express middleware and route registration
  config.js             Environment configuration and agency dates
  db.js                 PostgreSQL pool and transactions
  security.js           Passwords, sessions, CSRF, and authorization
  validation.js         Request schemas and French validation errors
  queries.js            Shared rental projection
  routes/               Auth, bootstrap data, rental, and admin APIs
  migrations/           Versioned PostgreSQL schema
  migrate.js            Checksum-verified migration runner
  seed.js               Idempotent initial data setup
  seed-data.js          Six sample vehicles
scripts/                Native database lifecycle and setup helpers
tests/                  API, direct SQL, and browser integration suites
docs/                   Setup and technical documentation
.github/workflows/      Automated tests on GitHub
.env.example            Configuration template with placeholders
compose.yaml            Optional Docker PostgreSQL instance
```

`dist/` is application source in this repository; it is not disposable generated output. `.openai/hosting.json` retains metadata for an earlier static preview and is not used by the Node server.

## Configuration and data

Start with automatic setup or copy [.env.example](.env.example) when connecting to an existing database. The main settings are `DATABASE_URL`, `PORT`, `APP_ORIGIN`, `APP_TIMEZONE`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. The [deployment guide](docs/DEPLOYMENT.md) documents every setting.

Credentials, database files, backups, dependencies, and test screenshots are excluded from Git. The application date uses `Africa/Tunis` by default. French display labels live in `dist/js/labels.js`; database enum values and API identifiers remain stable.

## Tests

```sh
npm test
npm run test:db
npm run test:ui
```

The suites create unique temporary PostgreSQL schemas and remove them afterward. They preserve the normal application's tables and records. Set `TEST_DATABASE_URL` to use a separate test database; it is required when `NODE_ENV=production`.

Windows browser tests use installed Microsoft Edge. For Playwright Chromium on macOS/Linux:

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:ui
```

GitHub Actions runs API, database, and Chromium browser checks on a fresh PostgreSQL service. See the repository's **Actions** tab for the result of each push.

## Scope

This project does not collect online payments and does not implement password recovery emails or email verification. Cars and rates in the seed data are illustrative. The photos come from Unsplash; fonts load from Google Fonts with local fallbacks.

Pushing the source to GitHub does not deploy the application. The full-stack app requires a host that runs Node.js and connects to PostgreSQL; GitHub Pages and static file servers do not run this backend.
