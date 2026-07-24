import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'dist', 'index.html');
if (!existsSync(htmlPath)) {
  console.error('MISS dist/index.html. Run npm run build first.');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const assets = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)]
  .map((match) => match[1]);
const uniqueAssets = [...new Set(assets)];
const totals = uniqueAssets.reduce((result, asset) => {
  const content = readFileSync(path.join(root, 'dist', asset));
  result.raw += content.length;
  result.gzip += gzipSync(content).length;
  return result;
}, { raw: 0, gzip: 0 });

const rawLimit = Number(process.env.INITIAL_JS_LIMIT_BYTES || 750_000);
const gzipLimit = Number(process.env.INITIAL_JS_GZIP_LIMIT_BYTES || 220_000);
console.log(`Initial JavaScript: ${totals.raw} bytes raw, ${totals.gzip} bytes gzip (${uniqueAssets.length} assets)`);
console.log(`Budget: ${rawLimit} bytes raw, ${gzipLimit} bytes gzip`);

if (totals.raw > rawLimit || totals.gzip > gzipLimit) {
  console.error('MISS initial JavaScript exceeds the configured performance budget.');
  process.exit(1);
}
console.log('OK initial JavaScript is within budget.');
