import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';

const root = process.cwd();
const args = process.argv.slice(2);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

const envPath = path.resolve(root, valueAfter('--env') || '.env.vercel.local');
const outputPath = path.resolve(root, valueAfter('--output') || 'production-admin-credentials.local');
const apply = args.includes('--apply');
const env = readEnvFile(envPath);

if (!env || !apply) {
  console.error(!env ? `MISS ${envPath}` : 'Refusing to rotate passwords without --apply.');
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

const accounts = [
  { email: 'admin@schoolxnow.local', password: crypto.randomBytes(24).toString('base64url') },
  { email: 'schooladmin@schoolxnow.local', password: crypto.randomBytes(24).toString('base64url') },
];
const connection = await mysql.createConnection({
  ...config,
  ssl: { rejectUnauthorized: !args.includes('--allow-self-signed') },
});

try {
  for (const account of accounts) {
    const [result] = await connection.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
      [await bcrypt.hash(account.password, 12), account.email],
    );
    if (result.affectedRows !== 1) {
      throw new Error(`Expected exactly one production account for ${account.email}`);
    }
  }
  await connection.execute('DELETE FROM password_reset_tokens');
} finally {
  await connection.end();
}

const content = [
  '# Rotated production credentials. Keep this ignored file private.',
  ...accounts.flatMap((account, index) => [
    `ACCOUNT_${index + 1}_EMAIL=${JSON.stringify(account.email)}`,
    `ACCOUNT_${index + 1}_PASSWORD=${JSON.stringify(account.password)}`,
  ]),
  '',
].join('\n');
fs.writeFileSync(outputPath, content, { encoding: 'utf8', mode: 0o600 });
console.log(`OK rotated production demo passwords and wrote ${outputPath}. No secret values printed.`);
