import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseRoot = path.join(root, 'release', 'shared-hosting');
const publicHtml = path.join(releaseRoot, 'public_html');
const backendTarget = path.join(releaseRoot, 'backend');

function withinRoot(target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function assertExists(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`MISS ${file}`);
    process.exit(1);
  }
}

function copyDir(source, target, filter = () => true) {
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter,
  });
}

for (const file of [
  'dist/index.html',
  'dist/.htaccess',
  'dist/api/index.php',
  'backend/public/index.php',
  'backend/database/schema.mysql.sql',
  'backend/.env.example',
]) {
  assertExists(file);
}

if (!withinRoot(releaseRoot)) {
  console.error('Refusing to write release outside the project root.');
  process.exit(1);
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
fs.mkdirSync(releaseRoot, { recursive: true });

copyDir(path.join(root, 'dist'), publicHtml);
copyDir(path.join(root, 'backend'), backendTarget, (source) => {
  const normalized = source.replaceAll('\\', '/');
  return !normalized.endsWith('/backend/.env');
});

const localEnvPath = path.join(root, 'backend', '.env');
const serverEnvPath = path.join(backendTarget, '.env.server-template');
fs.copyFileSync(
  fs.existsSync(localEnvPath) ? localEnvPath : path.join(root, 'backend', '.env.example'),
  serverEnvPath
);

const notes = [
  'SchoolXNow shared hosting upload layout',
  '',
  '1. Upload everything inside public_html/ into your hosting public_html directory.',
  '2. Upload backend/ beside public_html when possible.',
  '3. On the server, copy backend/.env.server-template to backend/.env and fill real DB/domain values.',
  '4. Import backend/database/schema.mysql.sql into MySQL.',
  '5. Visit https://your-domain.com/api/health.',
  '6. Visit https://your-domain.com/bootstrap and use SUPER_ADMIN_SECRET from backend/.env.',
  '',
  'Do not upload local placeholder database values.',
  '',
].join('\n');

fs.writeFileSync(path.join(releaseRoot, 'UPLOAD-STEPS.txt'), notes);

console.log('OK Prepared release/shared-hosting');
console.log('OK Upload release/shared-hosting/public_html contents to public_html');
console.log('OK Upload release/shared-hosting/backend beside public_html');
console.log('INFO backend/.env is intentionally not copied; fill it on the server from .env.server-template');
