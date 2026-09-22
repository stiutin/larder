/**
 * Makes sure an up-to-date *test* build exists before commands that need one (test:static, e2e, lighthouse).
 * Runs automatically as an npm `pre` script. A test build is prerendered against the mock API, so its content is
 * deterministic; a real build (`npm run build`) is replaced when a test build is needed.
 *
 * SKIP_BUILD=1 skips the check, e.g. in CI where the build comes from an artifact.
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const INFO = join('dist', 'larder', 'build-info.json');
const INPUTS = [
  'src',
  'angular.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'ngsw-config.json',
  'package-lock.json',
  'tests/mock-api',
];

if (process.env.SKIP_BUILD === '1') {
  process.exit(0);
}

function newestMtime(path) {
  if (!existsSync(path)) {
    return 0;
  }
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }
  return readdirSync(path)
    .filter((name) => !name.endsWith('.spec.ts'))
    .reduce((newest, name) => Math.max(newest, newestMtime(join(path, name))), 0);
}

const info = existsSync(INFO) ? JSON.parse(readFileSync(INFO, 'utf8')) : null;
const reason = !info
  ? 'no build found'
  : !info.mock || info.dataset !== 'default'
    ? 'the current build is not a test build (real API or showcase data)'
    : info.baseHref !== '/'
      ? `the current build uses base href ${info.baseHref}; tests expect /`
      : Math.max(...INPUTS.map(newestMtime)) > statSync(INFO).mtimeMs
        ? 'sources changed since the last build'
        : null;

if (!reason) {
  process.exit(0);
}

console.log(`\n▸ Building first: ${reason}.\n`);
const result = spawnSync('npm', ['run', 'build:mock'], {
  env: {...process.env, BASE_HREF: ''},
  shell: true,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
