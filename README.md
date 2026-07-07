# SchoolXNow Essential V2

SchoolXNow is a school management system with a React/Vite frontend and a PHP/MySQL backend for shared-hosting deployment.

## Requirements

- Node.js 20+
- npm
- PHP 8.1+ on the server
- MySQL/MariaDB
- Apache with `.htaccess` rewrite support

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

## Backend Setup

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
