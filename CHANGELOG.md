# Changelog

## [0.2.0] - 2026-07-24

### Production Hardening

This release begins the production-hardening phase with isolated Preview data,
credential safety, API abuse controls, production monitoring, and
database-backed integration coverage.

### Highlights

- Added separate Preview/test database provisioning and stopped Preview
  deployments from using production database credentials.
- Removed reusable public demo passwords and moved optional demo credentials to
  ignored environment variables.
- Added database-backed rate limits for login, password reset, registration,
  teacher portal, and bootstrap endpoints.
- Added sanitized backend error reporting, request IDs, production client-error
  telemetry, health database checks, and operational alert signals.
- Added strict MySQL 8 integration tests for every generic table route,
  Vercel-injected parameters, filtering, sorting, pagination, counts,
  authorization, school isolation, authentication states, and database errors.
- Added numbered, checksum-verified database migrations with deployment checks,
  backup tooling, and rollback guidance.
- Introduced a shared Node/PHP API contract and dual-backend contract tests.
- Standardized `VITE_API_MODE=mysql` while retaining temporary compatibility
  with `VITE_BACKEND_PROVIDER=php`.
- Added deliberate dashboard polling, mutation-driven refetching, manual
  refresh controls, and last-updated timestamps.
- Added custom SchoolXNow branding and removed reliance on external badges.

### Backend direction

The Node/Vercel API is the primary production backend. The PHP API remains a
contract-tested compatibility backend for shared-hosting installations.

[0.2.0]: https://github.com/Sabbirnde/schoolxnow/compare/v0.1.0...v0.2.0
