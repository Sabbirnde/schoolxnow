import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), 'backend', '.env');
const force = process.argv.includes('--force');
const secretKeys = ['JWT_SECRET', 'SUPER_ADMIN_SECRET'];

function makeSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return [
    '',
    'your_',
    'your-',
    'replace_with',
    'replace-this',
    'example.com',
    'admin@example.com',
  ].some((marker) => normalized.includes(marker));
}

if (!fs.existsSync(envPath)) {
  console.error('MISS backend/.env');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');
const updated = [];

for (const key of secretKeys) {
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(pattern);
  const currentValue = match?.[1]?.trim() ?? '';

  if (!match) {
    content += `${content.endsWith('\n') ? '' : '\n'}${key}=${makeSecret()}\n`;
    updated.push(key);
    continue;
  }

  if (force || isPlaceholder(currentValue)) {
    content = content.replace(pattern, `${key}=${makeSecret()}`);
    updated.push(key);
  }
}

fs.writeFileSync(envPath, content);

if (updated.length === 0) {
  console.log('OK PHP secrets already exist. No values printed.');
} else {
  console.log(`OK Updated ${updated.join(', ')} in backend/.env. No values printed.`);
}
