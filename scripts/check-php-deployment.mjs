import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'dist/index.html',
  'dist/.htaccess',
  'dist/api/index.php',
  'dist/api/.htaccess',
  'backend/public/index.php',
  'backend/public/.htaccess',
  'backend/database/schema.mysql.sql',
  'backend/.env.example',
  'public/.htaccess',
  'public/api/index.php',
  'public/api/.htaccess',
];

const frontendRequired = ['VITE_BACKEND_PROVIDER', 'VITE_API_URL'];
const backendRequired = [
  'DB_HOST',
  'DB_DATABASE',
  'DB_USERNAME',
  'DB_PASSWORD',
  'JWT_SECRET',
  'SUPER_ADMIN_SECRET',
  'CORS_ORIGIN',
  'FRONTEND_URL',
  'PUBLIC_API_URL',
];

function readEnv(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return null;

  return Object.fromEntries(
    fs
      .readFileSync(fullPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

function checkFile(file) {
  const exists = fs.existsSync(path.join(root, file));
  console.log(`${exists ? 'OK ' : 'MISS'} ${file}`);
  return exists;
}

function checkEnv(label, env, keys) {
  if (!env) {
    console.log(`MISS ${label}`);
    return false;
  }

  let ok = true;
  for (const key of keys) {
    const value = env[key] || '';
    const present = Boolean(value);
    const placeholder = isPlaceholder(value);
    const valid = present && !placeholder;

    if (!present) {
      console.log(`MISS ${label}:${key}`);
    } else if (placeholder) {
      console.log(`TODO ${label}:${key} contains a placeholder value`);
    } else {
      console.log(`OK  ${label}:${key}`);
    }

    ok = ok && valid;
  }

  return ok;
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return [
    'your_',
    'your-',
    'replace_with',
    'replace-this',
    'example.com',
    'admin@example.com',
  ].some((marker) => normalized.includes(marker));
}

console.log('SchoolXNow PHP deployment check\n');

let ok = requiredFiles.every(checkFile);

console.log('\nFrontend env');
const frontendEnv = readEnv('.env');
ok = checkEnv('.env', frontendEnv, frontendRequired) && ok;

if (frontendEnv?.VITE_BACKEND_PROVIDER !== 'php') {
  console.log('MISS .env:VITE_BACKEND_PROVIDER must be php for PHP/MySQL deployment');
  ok = false;
}

console.log('\nBackend env');
const backendEnv = readEnv('backend/.env');
ok = checkEnv('backend/.env', backendEnv, backendRequired) && ok;

console.log('\nDatabase import');
console.log('INFO Import backend/database/schema.mysql.sql into MySQL before first login.');
console.log('INFO Create the first super admin at /bootstrap using SUPER_ADMIN_SECRET.');

if (!ok) {
  console.log('\nDeployment check failed. Fill missing values/files before uploading.');
  process.exit(1);
}

console.log('\nDeployment check passed.');
