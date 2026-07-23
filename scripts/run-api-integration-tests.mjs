import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const vitest = path.resolve('node_modules/vitest/vitest.mjs');
const docker = spawnSync('docker', ['info'], { encoding: 'utf8', shell: false });
if (docker.status !== 0) {
  console.error('MISS Docker must be running for API integration tests.');
  process.exit(1);
}

const image = spawnSync('docker', ['image', 'inspect', 'mysql:8.4'], {
  encoding: 'utf8',
  shell: false,
});
if (image.status !== 0) {
  console.log('INFO Pulling pinned mysql:8.4 integration image...');
  const pull = spawnSync('docker', ['pull', 'mysql:8.4'], {
    stdio: 'inherit',
    shell: false,
  });
  if (pull.status !== 0) {
    console.error('MISS Unable to pull mysql:8.4.');
    process.exit(1);
  }
}

const result = spawnSync(
  process.execPath,
  [vitest, 'run', '--config', 'vitest.api.config.ts'],
  {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      RUN_API_INTEGRATION: 'true',
    },
  },
);

process.exit(result.status ?? 1);
