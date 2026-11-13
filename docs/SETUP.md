# Running Vellum on another computer

This guide starts with a fresh Git clone. The interface is in French. The same Node server serves both the browser files and the API at `http://localhost:3000`.

## 1. Install prerequisites

| Software | Required for | Notes |
| --- | --- | --- |
| [Git](https://git-scm.com/downloads) | Cloning/updating the repository | Any recent version |
| [Node.js](https://nodejs.org/en/download) | Running the app and npm | Version 22.18 or newer; use a supported LTS release |
| [PostgreSQL](https://www.postgresql.org/download/) | Native database setup | PostgreSQL 18 and its command-line tools; tested locally with 18.1 |
| [Docker Desktop / Engine](https://docs.docker.com/get-started/get-docker/) | Optional container database | Replaces the native PostgreSQL installation for this project |

Choose **one** database option below. Native setup creates its own instance on port `55432`, independent of a PostgreSQL service you may already have on port `5432`. Docker uses the same project port by default.

On Windows, the examples use `npm.cmd` to avoid PowerShell script execution-policy issues. On macOS/Linux, use `npm` instead.

## 2. Clone and install dependencies

```sh
git clone https://github.com/aymenmselmi/vellum.git
cd vellum
npm ci
```

For a private repository, sign into GitHub with an account that has access. Run every following command from the cloned `vellum` directory.

`npm ci` uses the committed `package-lock.json`. There is no frontend build step. The repository's `dist/` directory contains maintained source files and must be kept.

## 3A. Native PostgreSQL: automatic setup

### Windows PowerShell

Install PostgreSQL, then run:

```powershell
npm.cmd run setup
npm.cmd start
```

The helper searches `C:\Program Files\PostgreSQL\<version>\bin`. If your installation is elsewhere, set the directory containing `initdb.exe` and `pg_ctl.exe`:

```powershell
$env:PG_BIN = "D:\PostgreSQL\18\bin"
npm.cmd run setup
npm.cmd start
```

### macOS / Linux

Make sure `initdb` and `pg_ctl` are on `PATH`, then run as your normal user:

```sh
initdb --version
pg_ctl --version
npm run setup
npm start
```

If needed, specify the PostgreSQL binary directory. For example, for an installation using `/usr/lib/postgresql/18/bin`:

```sh
export PG_BIN=/usr/lib/postgresql/18/bin
npm run setup
npm start
```

On macOS, set `PG_BIN` to the `bin` directory of your PostgreSQL installation. Do not run `initdb` as root or use `sudo npm run setup`. The native workflow was verified on Windows; use the Docker or existing-database option if your operating system's PostgreSQL packaging makes the native tools inconvenient.

### What setup creates

`npm run setup`:

1. Creates a private local PostgreSQL cluster in `.local/postgres/`.
2. Generates separate cluster and application database credentials.
3. Creates database `vellum` and login `vellum_app`.
4. Writes `.env` with your connection string and a randomly generated administrator password.
5. Applies the SQL migrations and seeds six illustrative cars plus one administrator account.

The `.local/` directory and `.env` are ignored by Git. Setup preserves existing data and credentials when repeated. Do not copy another computer's `.local/postgres/` directory or credentials to initialize a new checkout.

If port `55432` is already occupied, choose another port **before the first setup**:

```powershell
$env:VELLUM_DB_PORT = "55433"
npm.cmd run setup
```

macOS/Linux equivalent:

```sh
VELLUM_DB_PORT=55433 npm run setup
```

The chosen port is saved in the local configuration and generated `DATABASE_URL`. Setting this variable later does not move an existing database instance.

## 3B. Docker PostgreSQL

This option requires Docker to be running, but does not require native PostgreSQL tools to start the app. Do not run the native instance on port `55432` at the same time.

Copy the configuration template:

```powershell
Copy-Item .env.example .env
```

macOS/Linux: `cp .env.example .env`.

Edit `.env`:

```dotenv
DATABASE_URL=postgresql://vellum_app:YOUR_DATABASE_PASSWORD@127.0.0.1:55432/vellum
POSTGRES_PASSWORD=YOUR_DATABASE_PASSWORD
ADMIN_EMAIL=admin@vellum.local
ADMIN_NAME="Vellum Admin"
ADMIN_PASSWORD=YOUR_DIFFERENT_ADMIN_PASSWORD
```

Keep the other settings from `.env.example`. Replace both password placeholders with your own unique values. `POSTGRES_PASSWORD` and the password in `DATABASE_URL` must match. If your database password contains special URL characters, URL-encode the password in `DATABASE_URL` while keeping `POSTGRES_PASSWORD` as the original value.

```sh
docker compose up -d --wait database
npm run db:migrate
npm run db:seed
npm start
```

Use `npm.cmd` for these commands in Windows PowerShell. Docker Compose reads `POSTGRES_PASSWORD` from `.env`. Use explicit migration and seed commands in Docker mode; `npm run setup` is the native-instance helper.

`compose.yaml` uses the official `postgres:18` image and a named volume at `/var/lib/postgresql`, as required by the [PostgreSQL 18 Docker image layout](https://hub.docker.com/_/postgres). `docker compose stop database` preserves the volume. Changing `POSTGRES_PASSWORD` later does not change an already initialized database password.

## 3C. An existing PostgreSQL server

Using SQL Shell (`psql`) or pgAdmin with your PostgreSQL administrator, create a dedicated login and database:

```sql
CREATE ROLE vellum_app LOGIN PASSWORD 'replace-with-a-long-unique-password';
CREATE DATABASE vellum OWNER vellum_app;
```

Copy `.env.example` to `.env`. Set `DATABASE_URL` to that server and database, and replace `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` with your chosen administrator details.

```sh
npm run db:migrate
npm run db:seed
npm start
```

The migration login must be allowed to create tables and the trusted `btree_gist` extension. If a managed provider restricts extensions, enable `btree_gist` in the `public` schema using its administrator first. This extension supports the constraint that rejects overlapping reservations.

For a remote database requiring TLS, set `DATABASE_SSL=true` and configure the provider's trusted certificate as required. Certificate verification remains enabled.

## 4. Open the site and sign in

Open **http://localhost:3000**. Use this exact hostname by default; the origin check expects `APP_ORIGIN=http://localhost:3000`.

- **Member:** choose **Connexion → Créer un compte**. A fresh installation does not contain member accounts.
- **Administrator:** choose **Administration** in the footer. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` used when the administrator was first seeded. Automatic setup generates these in your local `.env`.

Changing `ADMIN_PASSWORD` in `.env` after the account exists does not reset that account's password. Seeding is intentionally idempotent and preserves existing credentials.

Git transfers the application source and sample-car seed data. It does **not** transfer the previous computer's members, extra cars, sessions, or reservations. For those records, use the [database transfer guide](DATABASE.md).

## 5. Run it again later

Native database:

```sh
npm run db:start
npm start
```

Docker database:

```sh
docker compose up -d --wait database
npm start
```

For automatic Node server restarts during development, use `npm run dev`. Stop Node with **Ctrl+C**. Stop the native project database with `npm run db:stop`, or stop the Docker database with `docker compose stop database`. The database is a separate process; stopping Node does not stop PostgreSQL.

## 6. Check that everything works

Open **http://localhost:3000/api/health**. A working database returns:

```json
{"status":"ok"}
```

Run the automated checks:

```sh
npm test
npm run test:db
npm run test:ui
```

API and database tests use a unique temporary PostgreSQL schema and remove it after each run. The configured login needs permission to create schemas. Use `TEST_DATABASE_URL` for a separate test database; this is required when `NODE_ENV=production`.

Browser tests use the installed Microsoft Edge by default on Windows. For the Playwright Chromium browser on other platforms:

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:ui
```

On Linux, `npx playwright install --with-deps chromium` also installs the browser's OS dependencies when permitted. On Windows, a Chromium override is `$env:PLAYWRIGHT_CHANNEL="chromium"` before running `npm.cmd run test:ui`.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `npm.ps1 cannot be loaded` in PowerShell | Use `npm.cmd` and `npx.cmd`. |
| `node` / `npm` not found | Install Node.js, then open a new terminal. |
| `initdb` / `pg_ctl` missing | Install PostgreSQL tools and set `PG_BIN`, or choose Docker/existing PostgreSQL. |
| Connection refused on `55432` | Run `npm run db:start` for native mode or start the Docker database. |
| Port `55432` already used on first setup | Use `VELLUM_DB_PORT` before native setup, or configure another host port for Docker. |
| `EADDRINUSE` on `3000` | Another app/server is using that port. Stop it, or set both `PORT=3001` and `APP_ORIGIN=http://localhost:3001` in `.env`. |
| Login or saving fails with an origin error | Open the hostname and port configured in `APP_ORIGIN`; restart Node after changing `.env`. |
| Password authentication failed | Check the database credentials in `DATABASE_URL`. The website administrator password is a separate credential. |
| pgAdmin shows the wrong databases | Register a connection to host `127.0.0.1`, port `55432`, database `vellum`, username `vellum_app`, using the database password from `DATABASE_URL`. |
| Tables are missing | Run `npm run db:migrate`, then `npm run db:seed`. |
| A migration checksum differs | Restore the applied migration file and create a new migration for the change. `.gitattributes` keeps SQL line endings consistent across computers. |
| Existing Docker password no longer matches `.env` | Restore the original credential or change the database role's password explicitly. Container initialization variables do not reset existing roles. |
| Browser tests cannot find a browser | Install Playwright Chromium and set `PLAYWRIGHT_CHANNEL=chromium`, or use installed Edge on Windows. |
| Page opened as `file://` or through Python has no working API | Run `npm start` and open the Node server's URL. |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the code and data model, and [API.md](API.md) for endpoint contracts.
