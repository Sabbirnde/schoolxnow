# Shared API contract

[`api-contract.json`](api-contract.json) is the machine-readable source of truth shared by the Node/Vercel and PHP APIs. It defines the public endpoints, response envelopes, request-ID header, exposed tables, school-scoped tables, and table permissions for every role.

Both implementations load authorization and table metadata from this file:

- Node: `api/_lib/contract.ts`
- PHP: `backend/src/Core/ApiContract.php`

## Changing the API

1. Update `api-contract.json` and increment its semantic version when public behavior changes.
2. Update both backend adapters when the contract requires implementation changes.
3. Run `npm run check:api-contract`.
4. Run `npm run test:api-integration`. The database-backed suite starts both APIs against the same MySQL 8 fixture and compares health, authentication, authorization, and school isolation.
5. Document a difference below only when identical implementation is impractical. A documented difference must preserve the shared guarantee.

## Intentional differences

| Area | Node/Vercel | PHP/shared hosting | Shared guarantee |
| --- | --- | --- | --- |
| Upload storage | Vercel Blob | Hosting filesystem | Authenticated upload, matching bucket/MIME allowlists, public URL response |
| Request ID body | Header only is guaranteed | Header plus JSON-body `request_id` | `X-Request-ID` on every application response |
| Deployment | Primary production backend | Compatibility backend | Contract tests pass before release |
| Client-error telemetry | Sanitized browser batches at `/telemetry/errors` | Host-level PHP logging/alerting | Request IDs correlate client failures with sanitized server logs |

## Long-term backend direction

Node is the primary backend. It matches the production Vercel runtime, Blob storage, monitoring, and deployment/migration checks. PHP remains a supported compatibility adapter for shared-hosting installations.

New public API behavior must be contract-first and implemented in both adapters; avoid PHP-only features. PHP retirement should be considered only after supported shared-hosting installations have migrated and a communicated support window has elapsed.
