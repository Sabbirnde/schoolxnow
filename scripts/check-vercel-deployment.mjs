import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';
import { listMigrations } from './lib/migrations.mjs';

const root = process.cwd();
const envPath = process.argv.includes('--env')
  ? process.argv[process.argv.indexOf('--env') + 1]
  : '.env.vercel.local';

const requiredFiles = [
  'api/[...path].ts',
  'api/_lib/auth.ts',
  'api/_lib/contract.ts',
  'api/_lib/db.ts',
  'api/_lib/http.ts',
  'api/_lib/tables.ts',
  'backend/database/schema.mysql.sql',
  'backend/api-contract.json',
  'scripts/check-api-contract.mjs',
  'scripts/migrate-mysql.mjs',
  '.env.vercel.example',
  'vercel.json',
];

const requiredEnv = [
  'VITE_BACKEND_PROVIDER',
  'VITE_API_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_DATABASE',
  'DB_USERNAME',
  'DB_PASSWORD',
  'JWT_SECRET',
  'SUPER_ADMIN_SECRET',
  'CORS_ORIGIN',
  'FRONTEND_URL',
  'BLOB_READ_WRITE_TOKEN',
];

function checkFile(file) {
  const exists = fs.existsSync(path.join(root, file));
  console.log(`${exists ? 'OK  ' : 'MISS'} ${file}`);
  return exists;
}

function checkEnv(env) {
  if (!env) {
    console.log(`MISS ${envPath}`);
    return false;
  }

  let ok = true;
  for (const key of requiredEnv) {
    const valid = !isPlaceholder(env[key]);
    console.log(`${valid ? 'OK  ' : 'MISS'} ${envPath}:${key}`);
    ok = ok && valid;
  }

  if (env.VITE_BACKEND_PROVIDER !== 'php') {
    console.log(`MISS ${envPath}:VITE_BACKEND_PROVIDER must be php for the compatibility API client`);
    ok = false;
  }

  if (env.VITE_API_URL !== '/api') {
    console.log(`MISS ${envPath}:VITE_API_URL should be /api for same-domain Vercel deployment`);
    ok = false;
  }

  const host = String(envValue(env, 'DB_HOST', 'MYSQL_HOST') || '').toLowerCase();
  if (['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.log(`MISS ${envPath}:DB_HOST is local. Use an external MySQL host for Vercel.`);
    ok = false;
  }

  return ok;
}

console.log('SchoolXNow Vercel deployment check\n');
let ok = requiredFiles.every(checkFile);

console.log('\nEnvironment');
ok = checkEnv(readEnvFile(path.resolve(root, envPath))) && ok;

console.log('\nDatabase');
try {
  const migrations = listMigrations(root);
  console.log(`OK  ${migrations.length} ordered migration(s) with valid checksums`);
} catch (error) {
  console.log(`MISS ${error instanceof Error ? error.message : String(error)}`);
  ok = false;
}
console.log(`INFO Check database state: npm run db:migrate:status -- --env ${envPath}`);
console.log(`INFO Apply after backup: npm run db:migrate -- --env ${envPath} --apply`);
console.log('INFO Optional demo accounts: import backend/database/seed-super-admin.mysql.sql with --seed.');

console.log('\nStorage');
console.log('INFO Create a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.');

if (!ok) {
  console.log('\nVercel deployment check failed.');
  process.exit(1);
}

console.log('\nVercel deployment check passed.');
