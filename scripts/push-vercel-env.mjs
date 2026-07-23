import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { isPlaceholder, readEnvFile } from './lib/env-file.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const envPath = valueAfter('--env') || '.env.vercel.local';
const targets = (valueAfter('--targets') || 'production')
  .split(',')
  .map((target) => target.trim())
  .filter(Boolean);
const gitBranch = valueAfter('--git-branch');

const requiredKeys = [
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

const optionalKeys = [
  'APP_DEBUG',
  'DB_CONNECTION_LIMIT',
  'DB_SSL',
  'DB_SSL_REJECT_UNAUTHORIZED',
  'JWT_TTL_SECONDS',
  'UPLOAD_MAX_BYTES',
  'VITE_ERROR_TELEMETRY_ENDPOINT',
  'VITE_APP_VERSION',
];

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

function run(command, commandArgs, options = {}) {
  const isWindowsVercel = process.platform === 'win32' && command === 'vercel';
  const executable = isWindowsVercel ? process.execPath : command;
  const finalArgs = isWindowsVercel
    ? [path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'vercel', 'dist', 'vc.js'), ...commandArgs]
    : commandArgs;
  return spawnSync(executable, finalArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      VERCEL_TELEMETRY_DISABLED: '1',
    },
    ...options,
  });
}

const env = readEnvFile(path.resolve(root, envPath));
if (!env) {
  console.error(`MISS ${envPath}`);
  console.error('Create it from .env.vercel.example and fill production values first.');
  process.exit(1);
}
if (args.includes('--force-db-ssl')) {
  env.DB_SSL = 'true';
}
if (args.includes('--allow-self-signed-db')) {
  env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
}

const missing = requiredKeys.filter((key) => isPlaceholder(env[key]));
if (missing.length > 0) {
  console.error(`MISS required Vercel env values: ${missing.join(', ')}`);
  process.exit(1);
}

const whoami = run('vercel', ['whoami']);
if (whoami.status !== 0) {
  console.error('MISS Vercel CLI login. Run `vercel login` once, then rerun this script.');
  process.exit(1);
}

const keys = [...requiredKeys, ...optionalKeys].filter((key) => env[key] !== undefined);
for (const target of targets) {
  for (const key of keys) {
    const targetArgs = target === 'preview' && gitBranch
      ? [target, gitBranch]
      : [target];
    const add = run('vercel', [
      'env',
      'add',
      key,
      ...targetArgs,
      '--value',
      env[key],
      '--yes',
      '--force',
    ]);
    if (add.status !== 0) {
      console.error(`MISS failed to push ${key} to ${target}`);
      console.error(add.stderr || add.stdout);
      process.exit(1);
    }

    console.log(`OK ${key} -> ${target}`);
  }
}

console.log('OK Vercel environment variables pushed. No values printed.');
