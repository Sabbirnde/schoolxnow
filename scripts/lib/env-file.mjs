import fs from 'node:fs';

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function envValue(env, ...keys) {
  for (const key of keys) {
    if (env[key]) {
      return env[key];
    }
  }

  return undefined;
}

export function isPlaceholder(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === '') {
    return true;
  }

  return [
    'your_',
    'your-',
    'replace_with',
    'replace-this',
    'example.com',
    'vercel_blob_rw_token',
  ].some((marker) => normalized.includes(marker));
}
