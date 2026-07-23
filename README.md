# SchoolXNow Essential V2

SchoolXNow is a school management system built with React and Vite. It uses a
MySQL/MariaDB database through an HTTP API and can be deployed with either:

- the Node.js serverless API included for Vercel; or
- the PHP API included for shared hosting.

The application does **not** use Supabase. The frontend uses a neutral
`apiClient` that preserves a chainable query interface while sending requests
to the SchoolXNow Node/PHP API.

## Architecture

```text
React/Vite frontend
        |
        | VITE_API_URL (normally /api)
        v
SchoolXNow HTTP API
   |                  |
   | Vercel           | Shared hosting
   v                  v
Node serverless API   PHP API
   |                  |
   +--------+---------+
            v
      MySQL/MariaDB
```

| Layer | Implementation |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| Frontend data client | `src/integrations/php-api/api-client.ts` |
| Low-level HTTP client | `src/integrations/php-api/client.ts` |
| Vercel backend | `api/[...path].ts` with `mysql2` |
| Shared-hosting backend | `backend/public/index.php` with PHP PDO |
| Database schema | `backend/database/schema.mysql.sql` |
| Optional development seed | `backend/database/seed-super-admin.mysql.sql` |
| Vercel file storage | Vercel Blob |
| PHP file storage | Server filesystem under the configured upload directory |

Both backend implementations expose the same `/api` contract for login,
registration, profile management, password reset, bootstrap, table CRUD, and
uploads.

### Compatibility-mode environment value

`VITE_BACKEND_PROVIDER=php` is a legacy name for the frontend's MySQL API
compatibility path. Keep this value for **both PHP and Vercel Node deployments**.
It does not mean that a Vercel deployment runs PHP.

## Database

SchoolXNow uses MySQL or MariaDB. Supabase/PostgreSQL migrations, credentials,
Row Level Security, and realtime services are not required.

Use a current MySQL/MariaDB release that supports InnoDB foreign keys, JSON
columns, `utf8mb4`, and `DATETIME ... ON UPDATE CURRENT_TIMESTAMP`.

The schema currently creates these 20 tables:

| Area | Tables |
| --- | --- |
| Authentication | `users`, `password_reset_tokens`, `teacher_portal_tokens` |
| Profiles and authorization | `user_profiles`, `user_roles` |
| School structure | `schools`, `classes`, `subjects` |
| People | `students`, `teachers`, `teacher_applications` |
| Academics | `attendance`, `exams`, `exam_results`, `timetable` |
| Operations | `audit_logs`, `system_settings`, `notifications`, `notification_settings`, `feedback_submissions` |

The schema uses foreign keys and cascading rules to maintain relationships.
IDs are stored as UUID-compatible strings. Database connections are made only
by the backend; never expose database credentials in `VITE_*` variables.

### Import the schema

Using the included helper with an environment file:

```bash
npm run db:import:mysql -- --env .env.vercel.local
```

To also load development/demo accounts, first set unique passwords of at least
16 characters in the ignored environment file:

```bash
DEMO_SUPER_ADMIN_PASSWORD=unique_random_local_password
DEMO_SCHOOL_ADMIN_PASSWORD=another_unique_random_local_password
npm run db:import:mysql -- --env .env.vercel.local --seed
```

The importer accepts these optional arguments:

```text
--schema <sql-file>
--seed-file <sql-file>
```

Alternatively, import `backend/database/schema.mysql.sql` using phpMyAdmin or
the MySQL CLI. Import `backend/database/seed-super-admin.mysql.sql` only into a
local or disposable test database.

### Database configuration

| Variable | Required | Description |
| --- | --- | --- |
| `DB_HOST` | Yes | MySQL server hostname |
| `DB_PORT` | Yes | MySQL port, normally `3306` |
| `DB_DATABASE` | Yes | Database name |
| `DB_USERNAME` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `DB_CHARSET` | PHP | Defaults to `utf8mb4` |
| `DB_CONNECTION_LIMIT` | Node | Pool size; defaults to `5` |
| `DB_SSL` | Cloud DB | Set to `true` when the provider requires TLS |
| `DB_SSL_REJECT_UNAUTHORIZED` | Node | Keep `true` unless the provider explicitly requires otherwise |

The Node API also recognizes common `MYSQL_*` aliases, but the documented
`DB_*` names are preferred.

### Schema changes, backup, and production safety

- Back up the production database before applying schema changes.
- Review SQL migrations before importing them.
- Do not import the demo seed into production.
- Use a restricted application database user rather than a root account.
- Restrict database network access to the backend where the hosting provider
  supports allowlists or private networking.
- Use SSL for database connections over public networks.
- Store secrets only in hosting environment variables or ignored `.env` files.

The baseline schema is intended for a new, empty database. Use the versioned
files in `backend/database/migrations/` when altering production.

## Authentication and authorization

Authentication is implemented by the SchoolXNow API:

- passwords are hashed server-side;
- successful login returns a bearer token;
- JWT lifetime is controlled by `JWT_TTL_SECONDS`;
- the first super admin is created through the protected `/bootstrap` flow;
- roles and school membership are stored in `user_roles` and `user_profiles`;
- backend endpoints must enforce role and school boundaries.

MySQL does not provide Supabase-style Row Level Security. Authorization must
remain enforced in the Node and PHP APIs. Frontend visibility checks are for
user experience only and must not be treated as security controls.

The generic table API uses an explicit role/operation allowlist. School-scoped
records are always filtered by the authenticated user's `school_id`; profile,
notification-setting, feedback, and teacher-application records receive
additional user scoping. Non-super-admin requests cannot assign `role`,
`school_id`, or `user_id`. Audit logs are append-only through the API.

| Role | Generic table access |
| --- | --- |
| Super admin | All tables and operations; audit logs are read/create only |
| School admin | Own-school academic and user data; no role or system-setting changes |
| Teacher | Own-school reads; attendance/results and own settings/feedback writes |
| Student/guardian | Own profile, notifications, settings, and feedback only |

Authentication abuse controls are database-backed and shared across serverless
instances: login and teacher portal login allow 10 attempts per 15 minutes;
registration and password-reset requests allow 5 per hour; school registration
allows 3 per hour; bootstrap allows 5 per hour. Limits combine the client IP
with a normalized account identity where one is available.

## Preview database isolation

Preview deployments must never use the production database name or production
JWT/bootstrap secrets. Provision an isolated MySQL database and an ignored
Preview environment file with:

```bash
npm run db:provision:preview -- --env .env.vercel.local --apply
npm run vercel:env:push -- --env .env.preview.local --targets preview --git-branch your-branch
```

Add `--allow-self-signed` only when the provider's TCP database endpoint uses a
self-signed certificate. Transport remains encrypted, but a provider-issued CA
and `DB_SSL_REJECT_UNAUTHORIZED=true` are preferred.

For Railway MySQL, the public TCP proxy is internet reachable. Disable it and
use Railway private networking when the API runs inside the same Railway
project. A Vercel serverless deployment needs the public proxy unless static
egress/Secure Compute and an allowlist-capable database provider are used.

Magic-link/OTP verification is not currently available in the MySQL API mode.
Password reset and teacher portal token flows are provided by the API.

## Realtime and refresh behavior

Native database realtime subscriptions are not supported. The compatibility
channel interface reports realtime as unavailable instead of pretending that a
connection exists.

Screens that need fresh data should use:

- TanStack Query refetching;
- polling where already configured; or
- explicit refresh after a create, update, or delete operation.

Presence and broadcast channels are also unavailable. Implement WebSockets,
Server-Sent Events, or a managed realtime provider separately if true push
updates become a requirement.

## Requirements

- Node.js 20+
- npm
- MySQL or MariaDB
- PHP with PDO MySQL for shared-hosting deployments
- Vercel Blob storage for uploads on Vercel

## Local frontend setup

Copy `.env.example` to `.env`:

```env
VITE_BACKEND_PROVIDER=php
VITE_API_URL=/api
VITE_ERROR_TELEMETRY_ENDPOINT=
VITE_APP_VERSION=0.0.1
```

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

The development server runs on port `8080`. `VITE_API_URL` must point to a
running Node/PHP API. A relative `/api` value is recommended when frontend and
backend share a domain.

Build the production frontend:

```bash
npm run build
```

## Vercel deployment: Node API + MySQL

The catch-all serverless function at `api/[...path].ts` serves the backend
without PHP. Vercel routes `/api/*` to this function and serves the Vite build
from `dist`.

1. Create an externally reachable MySQL/MariaDB database.
2. Import `backend/database/schema.mysql.sql`.
3. Create a Vercel Blob store.
4. Copy `.env.vercel.example` to `.env.vercel.local`.
5. Fill in real database, application, and Blob values.
6. Run the deployment check.
7. Push the environment variables and deploy.

Required/recommended configuration:

```env
# Frontend
VITE_BACKEND_PROVIDER=php
VITE_API_URL=/api
VITE_ERROR_TELEMETRY_ENDPOINT=
VITE_APP_VERSION=0.0.1

# Node API
APP_DEBUG=false
DB_HOST=your-external-mysql-host
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password
DB_CONNECTION_LIMIT=5
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

JWT_SECRET=replace_with_a_long_random_secret_at_least_32_chars
JWT_TTL_SECONDS=86400
SUPER_ADMIN_SECRET=replace_with_a_long_random_bootstrap_secret

CORS_ORIGIN=https://your-vercel-domain.vercel.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
UPLOAD_MAX_BYTES=5242880
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token
```

Local deployment helper flow:

```bash
npm run check:vercel-deploy -- --env .env.vercel.local
npm run db:import:mysql -- --env .env.vercel.local
vercel login
npm run vercel:env:push -- --env .env.vercel.local --targets production
vercel deploy --prod
```

Important:

- `.env.vercel.local` is ignored by Git; do not commit it.
- Vercel cannot connect to a MySQL server at `localhost` or `127.0.0.1`.
- Set `DB_SSL=true` when required by the database provider.
- `BLOB_READ_WRITE_TOKEN` is required for `/api/uploads/*`.
- `npm run vercel:env:push` requires an authenticated Vercel CLI.

Health endpoint:

```text
https://your-vercel-domain.vercel.app/api/health
```

## Shared-hosting deployment: PHP API + MySQL

Generate secure placeholder values:

```bash
npm run generate:php-secrets
```

Create `backend/.env` from `backend/.env.example` and fill in real values:

```env
APP_DEBUG=false

DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password
DB_CHARSET=utf8mb4

JWT_SECRET=replace_with_a_long_random_secret_at_least_32_chars
JWT_TTL_SECONDS=86400
SUPER_ADMIN_SECRET=replace_with_a_long_random_bootstrap_secret

CORS_ORIGIN=https://your-domain.com
FRONTEND_URL=https://your-domain.com
PUBLIC_API_URL=https://your-domain.com/api
API_BASE_PATH=/api

UPLOAD_MAX_BYTES=5242880
# UPLOAD_STORAGE_DIR=/home/username/private-schoolxnow-uploads
```

Prepare the release:

```bash
npm run prepare:shared-hosting
```

Upload:

- `release/shared-hosting/public_html/*` into the hosting `public_html`;
- `release/shared-hosting/backend` beside `public_html` when the host permits.

On the server:

1. Copy `backend/.env.server-template` to `backend/.env`.
2. Add the real database, domain, and secret values.
3. Import `backend/database/schema.mysql.sql`.
4. Confirm `https://your-domain.com/api/health`.
5. Open `https://your-domain.com/bootstrap`.
6. Create the first super admin using `SUPER_ADMIN_SECRET`.

For safer uploads, configure `UPLOAD_STORAGE_DIR` outside the public web root
when the hosting layout supports it. The upload controller enforces
`UPLOAD_MAX_BYTES`.

## API overview

Both backends provide equivalent route groups:

| Route group | Purpose |
| --- | --- |
| `GET /api/health` | API service health |
| `/api/auth/*` | Login, registration, current user, password and portal-token flows |
| `/api/bootstrap/*` | First-super-admin status and creation |
| `/api/public/schools` | Public school lookup |
| `/api/tables/{table}` | Authorized table list/create operations |
| `/api/tables/{table}/count` | Authorized count queries |
| `/api/tables/{table}/{id}` | Authorized read/update/delete operations |
| `/api/uploads/{bucket}` | Authenticated file upload |

Allowed upload buckets are `avatars`, `student-photos`, and `documents`.

## Development seed accounts

Use these accounts only after importing the optional seed into a local or test
database.

The seed creates `admin@schoolxnow.local` and
`schooladmin@schoolxnow.local`. Their passwords are supplied through the
ignored `DEMO_SUPER_ADMIN_PASSWORD` and `DEMO_SCHOOL_ADMIN_PASSWORD`
variables; no working password or reusable password hash is stored in Git.

Never import these seed identities into production.

## Validation and useful commands

```bash
# TypeScript
npm run type-check

# Tests
npm test -- --run

# Production frontend
npm run build

# PHP syntax through Docker
npm run lint:php

# Deployment checks
npm run check:php-deploy
npm run check:vercel-deploy -- --env .env.vercel.local

# Dependency audit
npm audit --omit=dev
```

`check:php-deploy` expects built release files and real values in `.env` and
`backend/.env`. Placeholder credentials intentionally cause the check to fail.

## Troubleshooting

### The frontend reports `Missing VITE_API_URL`

Create `.env`, set `VITE_API_URL=/api`, and restart the Vite/build process.
Vite environment variables are embedded at build time.

### Vercel cannot connect to MySQL

Use an external database hostname, verify provider firewall rules, and enable
`DB_SSL` if required. Confirm that the database user can connect from Vercel.

### API returns unauthorized

Log in again and verify `JWT_SECRET` is stable across deployments. Changing the
secret invalidates existing tokens.

### Bootstrap fails

Confirm the schema is imported, `SUPER_ADMIN_SECRET` matches the server value,
and a super admin has not already been created.

### Uploads fail

On Vercel, verify `BLOB_READ_WRITE_TOKEN`. On PHP hosting, verify directory
permissions, `UPLOAD_STORAGE_DIR`, PHP upload limits, and `UPLOAD_MAX_BYTES`.

### Data does not update automatically

Realtime subscriptions are unavailable. Refresh the query, use configured
polling, or reload the page.

## Repository

```text
https://github.com/Sabbirnde/schoolxnow
```
