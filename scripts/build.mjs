/**
 * Production build for GitHub Pages: prerendered pages + the files Pages needs.
 *
 *   npm run build                          # real API, base href "/"
 *   BASE_HREF=/larder/ npm run build       # a project site: https://<user>.github.io/larder/
 *   npm run build:mock                     # prerender against the local mock API (tests, offline)
 *   npm run build:mock -- --showcase       # the realistic demo dataset (screenshots)
 *
 * Environment: BASE_HREF, PUBLIC_URL (e.g. https://stiutin.github.io/larder), API_URL.
 */
import {spawn} from 'node:child_process';
import {startMockApi} from '../tests/mock-api/server.mjs';

const mock = process.argv.includes('--mock');
const env = {...process.env};
let api;

if (mock) {
  // Not 4190: that is on the fetch spec's list of blocked ports (ManageSieve).
  const port = 4180;
  const dataset = process.argv.includes('--showcase') ? 'showcase' : 'default';
  api = await startMockApi(port, dataset === 'showcase' ? 'showcase' : undefined);
  env.LARDER_DATASET = dataset;
  env.API_URL = `http://127.0.0.1:${port}`;
  env.LARDER_MOCK_BUILD = '1';
  env.PUBLIC_URL ??= 'https://larder.test';
}

const args = ['build'];
if (env.BASE_HREF) {
  args.push('--base-href', env.BASE_HREF);
}

// Asynchronous on purpose: a synchronous spawn would block this process, and with it the mock API
// the prerenderer is calling. `shell: true` so that `npx` resolves on Windows too.
const run = (command, commandArgs) =>
  new Promise((done) => {
    spawn(command, commandArgs, {env, shell: true, stdio: 'inherit'}).on('exit', (code) => done(code ?? 1));
  });

let status = await run('npx', ['ng', ...args]);
if (status === 0) {
  status = await run('node', ['scripts/pages-postbuild.mjs']);
}

api?.close();
process.exit(status);
