import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {JSDOM} from 'jsdom';

const PORT = 4250;
const base = `http://localhost:${PORT}`;
const BROWSER = join('dist', 'larder', 'browser');
let server;

before(async () => {
  server = spawn(process.execPath, ['scripts/serve-static.mjs'], {
    env: {...process.env, BASE_HREF: '/', PORT: String(PORT)},
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    if (
      await fetch(base).then(
        () => true,
        () => false
      )
    )
      return;
    await sleep(100);
  }
  throw new Error('static server did not start');
});

after(() => server?.kill());

const has = (html, pattern, message) => assert.ok(pattern.test(html), message ?? `expected ${pattern}`);
const hasNot = (html, pattern, message) => assert.ok(!pattern.test(html), message ?? `did not expect ${pattern}`);

const get = async (path) => {
  const response = await fetch(base + path, {redirect: 'manual'});
  return {headers: response.headers, html: await response.text(), status: response.status};
};

test('the catalogue is prerendered with products, not a skeleton', async () => {
  const {html, status} = await get('/');
  assert.equal(status, 200);
  has(html, /Test product 1</);
  has(html, /Test product 20</);
  hasNot(html, /Test product 21</, 'exactly 20 products per page');
  has(html, /Page 1 of 3/);
  hasNot(html, /class="catalog__skeleton/, 'skeleton in the markup');
});

test('catalogue state is handed to the client through TransferState', async () => {
  const {html} = await get('/');
  const state = html.match(/<script id="ng-state" type="application\/json">(.*?)<\/script>/s)?.[1] ?? '';
  has(state, /catalog-state/);
  has(state, /"status":"loaded"/);
});

test('query variants get the same file - the client store follows the URL after hydration', async () => {
  const {html, status} = await get('/?page=3&sort=price-desc');
  assert.equal(status, 200);
  has(html, /Test product 1</);
});

test('every product has its own page with h1, title and Open Graph', async () => {
  assert.equal(readdirSync(join(BROWSER, 'product')).length, 45, 'one directory per product from the API');

  const {html, status} = await get('/product/7/');
  assert.equal(status, 200);
  has(html, /<h1[^>]*>\s*Test product 7\s*<\/h1>/);
  has(html, /<title>Test product 7 · Larder<\/title>/);
  has(html, /property="og:image" content="https:\/\/cdn\.dummyjson\.com\/test\/7\.webp"/);
  has(html, /fetchpriority="high"/, 'LCP image with high priority');
});

test('like GitHub Pages: /about redirects to /about/', async () => {
  const {headers, status} = await get('/about');
  assert.equal(status, 301);
  assert.equal(headers.get('location'), '/about/');
});

test('About, Contact and the cart shell are prerendered', async () => {
  for (const [path, heading] of [
    ['/about/', /A pantry for the moments when the network runs dry/],
    ['/contact/', /Say hello/],
    ['/cart/', /<h1[^>]*>\s*Cart\s*<\/h1>/],
  ]) {
    const {html, status} = await get(path);
    assert.equal(status, 200, path);
    has(html, heading, `${path}: heading`);
  }
});

test('the cart is prerendered as a loading shell - it lives on the device', async () => {
  const {html} = await get('/cart/');
  hasNot(html, /Your cart is empty/, 'the server must not claim the cart is empty');
});

test('unknown paths get 404.html: status 404 and the client shell', async () => {
  const {html, status} = await get('/definitely-missing');
  assert.equal(status, 404);
  has(html, /<app-root><\/app-root>/, 'client shell without prerendered content');
});

test('Open Graph URLs are absolute when PUBLIC_URL is set at build time', async () => {
  const {html} = await get('/about/');
  has(html, /<meta(?=[^>]*property="og:url")(?=[^>]*content="https:\/\/larder\.test\/about")[^>]*>/);
  has(html, /property="og:image" content="https:\/\/larder\.test\/assets\/brand\/og-image\.png"/);
});

test('GitHub Pages files: .nojekyll, 404.html; the Service Worker caches the client shell', () => {
  assert.ok(existsSync(join(BROWSER, '.nojekyll')));
  assert.ok(existsSync(join(BROWSER, '404.html')));
  const ngsw = JSON.parse(readFileSync(join(BROWSER, 'ngsw.json'), 'utf8'));
  assert.equal(ngsw.index, '/index.csr.html');
  assert.equal(ngsw.navigationRequestStrategy, 'freshness');
  assert.ok(ngsw.hashTable['/index.csr.html'], 'client shell precached for offline navigation');
});

test('landmarks: skip link, lang, main', async () => {
  const {html} = await get('/');
  has(html, /<html[^>]*lang="en"/);
  has(html, /<a[^>]*href="#main"[^>]*>\s*Skip to content/);
  has(html, /<main[^>]*id="main"/);
});

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core'), 'utf8');

async function axe(path) {
  const {html} = await get(path);
  const dom = new JSDOM(html, {runScripts: 'outside-only', url: base + path});
  dom.window.eval(axeSource);
  const result = await dom.window.axe.run(dom.window.document, {
    resultTypes: ['violations'],
    rules: {'color-contrast': {enabled: false}},
  });
  return result.violations.map((violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`);
}

for (const path of ['/', '/product/3/', '/about/', '/contact/', '/cart/']) {
  test(`axe: no violations on ${path}`, async () => {
    const violations = await axe(path);
    assert.equal(violations.length, 0, violations.join('\n'));
  });
}
