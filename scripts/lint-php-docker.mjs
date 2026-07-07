import { spawnSync } from 'node:child_process';
import { cwd, exit } from 'node:process';

const image = 'php:8.3-cli-alpine';
const repo = cwd();

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${repo}:/app`,
    '-w',
    '/app',
    image,
    'sh',
    '-lc',
    "find backend -name '*.php' -print0 | xargs -0 -n1 php -l",
  ],
  {
    stdio: 'inherit',
    shell: false,
  }
);

if (result.error) {
  console.error(result.error.message);
  exit(1);
}

exit(result.status ?? 1);
