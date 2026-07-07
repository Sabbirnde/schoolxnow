# SchoolXNow Essential V2

SchoolXNow is a school management system with a React/Vite frontend, a Vercel Node API, and MySQL database support.

## Requirements

- Node.js 20+
- npm
- MySQL/MariaDB
- Vercel Blob storage for uploads when deploying the API to Vercel

## Frontend Setup

Copy `.env.example` to `.env` and use PHP backend mode:

```env
VITE_BACKEND_PROVIDER=php
VITE_API_URL=/api
```

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build production files:

```bash
npm run build
```

## Vercel Full Deployment

This repo includes a Vercel serverless API at `api/[...path].ts`. It replaces the PHP runtime for Vercel deployments while keeping the same frontend API path: `/api`.

1. Create an external MySQL database.
2. Import `backend/database/schema.mysql.sql`.
3. Optionally import `backend/database/seed-super-admin.mysql.sql` for demo logins.
4. Create a Vercel Blob store.
5. Add the variables from `.env.vercel.example` to Vercel Project Settings.
6. Deploy with Vercel.

Required Vercel variables:

```env
VITE_BACKEND_PROVIDER=php
VITE_API_URL=/api

DB_HOST=your-mysql-host
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password

JWT_SECRET=generated_value
SUPER_ADMIN_SECRET=generated_value
CORS_ORIGIN=https://your-vercel-domain.vercel.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token
```

Local helper flow:

```bash
cp .env.vercel.example .env.vercel.local
npm run check:vercel-deploy -- --env .env.vercel.local
npm run db:import:mysql -- --env .env.vercel.local --seed
vercel login
npm run vercel:env:push -- --env .env.vercel.local --targets production
vercel deploy --prod
```

Notes:

- `.env.vercel.local` is ignored by git. Keep real DB passwords and Blob tokens there only.
- `DB_HOST` must be an external MySQL host. `localhost` and `127.0.0.1` will not work from Vercel.
- `npm run db:import:mysql -- --seed` imports the schema and demo login accounts.
- `npm run vercel:env:push` requires the Vercel CLI to be logged in.

Health check:

```text
https://your-vercel-domain.vercel.app/api/health
```

## PHP Backend Setup

The old PHP backend is still kept for shared-hosting deployments.

Create backend secrets:

```bash
npm run generate:php-secrets
```

Edit `backend/.env` with real hosting values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password

JWT_SECRET=generated_value
SUPER_ADMIN_SECRET=generated_value

CORS_ORIGIN=https://your-domain.com
FRONTEND_URL=https://your-domain.com
PUBLIC_API_URL=https://your-domain.com/api
API_BASE_PATH=/api
```

Import the database schema:

```text
backend/database/schema.mysql.sql
```

Import demo login accounts for local testing:

```text
backend/database/seed-super-admin.mysql.sql
```

## Demo Login Accounts

Use these accounts only for local development and test databases.

Super admin:

```text
Email: admin@schoolxnow.local
Password: Admin@12345
Role: super_admin
```

School admin:

```text
School: Demo School
Email: schooladmin@schoolxnow.local
Password: SchoolAdmin@12345
Role: school_admin
Status: approved
```

## Shared Hosting Deployment

Prepare upload files:

```bash
npm run prepare:shared-hosting
```

Upload:

- `release/shared-hosting/public_html/*` to hosting `public_html`
- `release/shared-hosting/backend` beside `public_html` when possible

On the server:

1. Copy `backend/.env.server-template` to `backend/.env`.
2. Fill real DB/domain values.
3. Import `backend/database/schema.mysql.sql`.
4. Visit `https://your-domain.com/api/health`.
5. Visit `https://your-domain.com/bootstrap`.
6. Create the first super admin using `SUPER_ADMIN_SECRET`.

## Verification

Run checks before deployment:

```bash
npm run type-check
npm test -- --run
npm run build
npm run lint:php
npm run check:php-deploy
npm audit --omit=dev
```

`npm run check:php-deploy` will fail until real server DB and domain values are added to `backend/.env`.

## GitHub

Current repository:

```text
https://github.com/Sabbirnde/schoolxnow
```
