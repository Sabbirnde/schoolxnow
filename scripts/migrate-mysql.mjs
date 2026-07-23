import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';
import { applyMigrations, migrationStatus } from './lib/migrations.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};
const envPath = path.resolve(root, valueAfter('--env') || '.env.vercel.local');
const apply = args.includes('--apply');
const allowSelfSigned = args.includes('--allow-self-signed');
const useProcessEnv = args.includes('--process-env');
const env = useProcessEnv ? process.env : readEnvFile(envPath);

if (!env) {
  console.error(`MISS ${envPath}`);
  process.exit(1);
}

const config = {
  host: envValue(env, 'DB_HOST', 'MYSQL_HOST'),
  port: Number(envValue(env, 'DB_PORT', 'MYSQL_PORT') || 3306),
  database: envValue(env, 'DB_DATABASE', 'MYSQL_DATABASE', 'MYSQL_DATABASE_NAME'),
  user: envValue(env, 'DB_USERNAME', 'MYSQL_USER', 'MYSQL_USERNAME'),
  password: envValue(env, 'DB_PASSWORD', 'MYSQL_PASSWORD'),
};
const missing = Object.entries(config)
  .filter(([key, value]) => key !== 'port' && isPlaceholder(value))
  .map(([key]) => key);
if (missing.length > 0) {
  console.error(`MISS database config: ${missing.join(', ')}`);
  process.exit(1);
}

const connection = await mysql.createConnection({
  ...config,
  multipleStatements: true,
  ssl: env.DB_SSL === 'true' || args.includes('--force-ssl')
    ? { rejectUnauthorized: !allowSelfSigned && env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
});

try {
  if (apply) {
    const result = await applyMigrations(connection, {
      root,
      appliedBy: process.env.GITHUB_ACTOR || process.env.USERNAME || 'schoolxnow-cli',
      onProgress: ({ migration, action }) => {
        console.log(`${action === 'baseline' ? 'BASELINE' : 'APPLY'} ${migration.filename}`);
      },
    });
    console.log(`OK database is current at version ${String(result.migrations.at(-1).version).padStart(4, '0')}.`);
  } else {
    const status = await migrationStatus(connection, root);
    for (const migration of status.pending) {
      console.log(`PENDING ${migration.filename}`);
    }
    if (status.pending.length > 0) {
      console.error(`MISS ${status.pending.length} pending migration(s). Rerun with --apply after taking a backup.`);
      process.exitCode = 1;
    } else {
      console.log(`OK all ${status.migrations.length} migration(s) are applied and checksums match.`);
    }
  }
} finally {
  await connection.end();
}
