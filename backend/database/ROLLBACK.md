# Database backup and rollback

Run migrations only after a verified backup. MySQL DDL can commit implicitly,
so the migration runner stops on the first failure but cannot promise an
automatic transactional rollback for schema changes.

## Before applying migrations

```bash
export MYSQL_PWD='database-password'
mysqldump \
  --host='database-host' \
  --port=3306 \
  --user='database-user' \
  --ssl-mode=REQUIRED \
  --single-transaction \
  --routines \
  --triggers \
  --no-tablespaces \
  --databases database_name \
  | gzip > schoolxnow-before-migration.sql.gz

gzip -t schoolxnow-before-migration.sql.gz
```

Store the dump outside the application server and record the production commit
SHA, current migration version, dump size, and creation time.

## Apply and verify

```bash
npm run db:migrate:status -- --env .env.vercel.local
npm run db:migrate -- --env .env.vercel.local --apply
npm run db:migrate:status -- --env .env.vercel.local
```

The runner takes a MySQL advisory lock, applies files in numeric order, stores
their SHA-256 checksums in `schema_migrations`, and refuses modified or missing
history.

## Rollback decision

Prefer a forward corrective migration when application writes have continued
after deployment. Restoring a dump discards every write made after the backup.

For an immediate full rollback:

1. Put the application in maintenance/read-only mode.
2. Roll back the application deployment.
3. Create a forensic dump of the failed database.
4. Restore the verified pre-migration dump into a new empty database.
5. Point the application to the restored database.
6. Run the health check and critical login/dashboard smoke tests.
7. Re-enable writes only after verification.

```bash
gunzip --stdout schoolxnow-before-migration.sql.gz |
  MYSQL_PWD='database-password' mysql \
    --host='database-host' \
    --port=3306 \
    --user='database-user' \
    --ssl-mode=REQUIRED
```

## Migration-specific reversal

- `0001_baseline_schema`: never drop individual baseline tables in production;
  restore the full backup into a new database.
- `0002_security_hardening`: after rolling back application code, the table can
  be removed with `DROP TABLE api_rate_limits`, but this deletes rate-limit
  history. A forward fix is safer.

Never delete or edit a row in `schema_migrations` merely to bypass a checksum
or failed migration. Repair the schema, then apply a new numbered migration.
