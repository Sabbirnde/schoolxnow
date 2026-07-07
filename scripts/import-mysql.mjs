import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const envPath = valueAfter('--env') || '.env.vercel.local';
const includeSeed = args.includes('--seed');
const schemaPath = valueAfter('--schema') || 'backend/database/schema.mysql.sql';
const seedPath = valueAfter('--seed-file') || 'backend/database/seed-super-admin.mysql.sql';

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

function readSql(file) {
  const fullPath = path.resolve(root, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`MISS ${file}`);
    process.exit(1);
  }

  return fs.readFileSync(fullPath, 'utf8');
}

const env = readEnvFile(path.resolve(root, envPath));
if (!env) {
  console.error(`MISS ${envPath}`);
  console.error('Create it from .env.vercel.example and fill external MySQL credentials first.');
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

if (['localhost', '127.0.0.1', '::1'].includes(String(config.host).toLowerCase())) {
  console.error('MISS DB_HOST is local. Vercel needs an external MySQL host reachable from the internet.');
  process.exit(1);
}

const connection = await mysql.createConnection({
  ...config,
  multipleStatements: true,
  ssl:
    env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : undefined,
});

try {
  console.log(`Importing schema into ${config.database} at ${config.host}. No password printed.`);
  await connection.query(readSql(schemaPath));
  console.log(`OK imported ${schemaPath}`);

  if (includeSeed) {
    await connection.query(readSql(seedPath));
    console.log(`OK imported ${seedPath}`);
  }
} finally {
  await connection.end();
}

