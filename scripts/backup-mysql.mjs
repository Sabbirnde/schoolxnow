import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};
const envPath = path.resolve(valueAfter('--env') || '.env.vercel.local');
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const outputPath = path.resolve(valueAfter('--output') || `schoolxnow-backup-${timestamp}.sql.gz`);
const env = readEnvFile(envPath);

if (!env) {
  console.error(`MISS ${envPath}`);
  process.exit(1);
}
if (!outputPath.endsWith('.sql.gz') || (fs.existsSync(outputPath) && !args.includes('--force'))) {
  console.error('MISS backup output must end in .sql.gz and must not already exist.');
  process.exit(1);
}

const config = {
  host: envValue(env, 'DB_HOST', 'MYSQL_HOST'),
  port: envValue(env, 'DB_PORT', 'MYSQL_PORT') || '3306',
  database: envValue(env, 'DB_DATABASE', 'MYSQL_DATABASE', 'MYSQL_DATABASE_NAME'),
  user: envValue(env, 'DB_USERNAME', 'MYSQL_USER', 'MYSQL_USERNAME'),
  password: envValue(env, 'DB_PASSWORD', 'MYSQL_PASSWORD'),
};
const missing = Object.entries(config).filter(([, value]) => isPlaceholder(value)).map(([key]) => key);
if (missing.length > 0) {
  console.error(`MISS database config: ${missing.join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const dump = spawn('docker', [
  'run', '--rm', '--env', 'MYSQL_PWD',
  'mysql:8.4',
  'mysqldump',
  `--host=${config.host}`,
  `--port=${config.port}`,
  `--user=${config.user}`,
  '--ssl-mode=REQUIRED',
  '--single-transaction',
  '--routines',
  '--triggers',
  '--no-tablespaces',
  '--set-gtid-purged=OFF',
  '--databases',
  config.database,
], {
  env: { ...process.env, MYSQL_PWD: config.password },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
dump.stderr.setEncoding('utf8');
dump.stderr.on('data', (chunk) => {
  stderr += chunk;
});
const completed = new Promise((resolve, reject) => {
  dump.on('error', reject);
  dump.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `mysqldump exited ${code}`)));
});

try {
  await Promise.all([
    pipeline(dump.stdout, createGzip({ level: 9 }), fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 })),
    completed,
  ]);
  const size = fs.statSync(outputPath).size;
  if (size < 100) {
    throw new Error('Backup output is unexpectedly small.');
  }
  console.log(`OK verified compressed MySQL backup at ${outputPath} (${size} bytes).`);
} catch (error) {
  fs.rmSync(outputPath, { force: true });
  console.error(`MISS backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
