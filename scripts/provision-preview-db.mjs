import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const sourcePath = path.resolve(root, valueAfter('--env') || '.env.vercel.local');
const outputPath = path.resolve(root, valueAfter('--output') || '.env.preview.local');
const apply = args.includes('--apply');
const allowSelfSigned = args.includes('--allow-self-signed');
const source = readEnvFile(sourcePath);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

function randomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

function escapeEnv(value) {
  return JSON.stringify(String(value));
}

if (!source) {
  console.error(`MISS ${sourcePath}`);
  process.exit(1);
}
if (!source.VITE_API_MODE && source.VITE_BACKEND_PROVIDER === 'php') {
  source.VITE_API_MODE = 'mysql';
  console.warn('WARN VITE_BACKEND_PROVIDER=php is deprecated; writing VITE_API_MODE=mysql');
}

const sourceDatabase = envValue(source, 'DB_DATABASE', 'MYSQL_DATABASE', 'MYSQL_DATABASE_NAME');
const previewDatabase = valueAfter('--database') || `${sourceDatabase}_preview`;
const frontendUrl = valueAfter('--frontend-url');
if (!/^[a-zA-Z0-9_]+$/.test(previewDatabase) || previewDatabase === sourceDatabase) {
  console.error('MISS preview database must be a safe, distinct MySQL database name.');
  process.exit(1);
}

const config = {
  host: envValue(source, 'DB_HOST', 'MYSQL_HOST'),
  port: Number(envValue(source, 'DB_PORT', 'MYSQL_PORT') || 3306),
  user: envValue(source, 'DB_USERNAME', 'MYSQL_USER', 'MYSQL_USERNAME'),
  password: envValue(source, 'DB_PASSWORD', 'MYSQL_PASSWORD'),
};
const missing = Object.entries({ ...config, sourceDatabase })
  .filter(([key, value]) => key !== 'port' && isPlaceholder(value))
  .map(([key]) => key);
if (missing.length > 0) {
  console.error(`MISS database config: ${missing.join(', ')}`);
  process.exit(1);
}
if (!apply) {
  console.error('Refusing to provision without --apply.');
  process.exit(1);
}

const ssl = { rejectUnauthorized: !allowSelfSigned };
const admin = await mysql.createConnection({ ...config, ssl });
try {
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${previewDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
} finally {
  await admin.end();
}

const preview = await mysql.createConnection({ ...config, database: previewDatabase, multipleStatements: true, ssl });
const superAdminPassword = randomPassword();
const schoolAdminPassword = randomPassword();
const jwtSecret = crypto.randomBytes(48).toString('base64url');
const bootstrapSecret = crypto.randomBytes(48).toString('base64url');
try {
  const [existingTables] = await preview.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
    [previewDatabase],
  );
  if (Number(existingTables[0].count) === 0) {
    const schema = fs.readFileSync(path.resolve(root, 'backend/database/schema.mysql.sql'), 'utf8');
    await preview.query(schema);
  }

  const seed = fs
    .readFileSync(path.resolve(root, 'backend/database/seed-super-admin.mysql.sql'), 'utf8')
    .replace('{{DEMO_SUPER_ADMIN_PASSWORD_HASH}}', await bcrypt.hash(superAdminPassword, 12))
    .replace('{{DEMO_SCHOOL_ADMIN_PASSWORD_HASH}}', await bcrypt.hash(schoolAdminPassword, 12));
  await preview.query(seed);
} finally {
  await preview.end();
}

const managedKeys = [
  'VITE_API_MODE', 'VITE_BACKEND_PROVIDER', 'VITE_API_URL', 'VITE_ERROR_TELEMETRY_ENDPOINT', 'VITE_APP_VERSION',
  'APP_DEBUG', 'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_CONNECTION_LIMIT',
  'JWT_TTL_SECONDS',
  'UPLOAD_MAX_BYTES', 'BLOB_READ_WRITE_TOKEN',
];
const output = [
  '# Generated Preview-only configuration. This file is ignored by Git.',
  ...managedKeys
    .filter((key) => source[key] !== undefined)
    .map((key) => `${key}=${escapeEnv(source[key])}`),
  `CORS_ORIGIN=${escapeEnv(frontendUrl || source.CORS_ORIGIN || source.FRONTEND_URL || '')}`,
  `FRONTEND_URL=${escapeEnv(frontendUrl || source.FRONTEND_URL || source.CORS_ORIGIN || '')}`,
  `DB_DATABASE=${escapeEnv(previewDatabase)}`,
  'DB_SSL="true"',
  `DB_SSL_REJECT_UNAUTHORIZED=${escapeEnv(String(!allowSelfSigned))}`,
  `JWT_SECRET=${escapeEnv(jwtSecret)}`,
  `SUPER_ADMIN_SECRET=${escapeEnv(bootstrapSecret)}`,
  `DEMO_SUPER_ADMIN_PASSWORD=${escapeEnv(superAdminPassword)}`,
  `DEMO_SCHOOL_ADMIN_PASSWORD=${escapeEnv(schoolAdminPassword)}`,
  '',
].join('\n');
fs.writeFileSync(outputPath, output, { encoding: 'utf8', mode: 0o600 });

console.log(`OK provisioned isolated Preview database and wrote ${outputPath}.`);
console.log('OK generated unique Preview demo passwords; no secret values printed.');
