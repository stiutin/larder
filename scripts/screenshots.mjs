/**
 * README screenshots, reproducible from the code.
 *
 *   npm run screenshots                                           # builds with the showcase data, then shoots
 *   BASE_URL=https://stiutin.github.io/larder/ npm run screenshots  # the live site, real product photos
 *
 * Output: .github/screenshots/*.png (used by the README). Set CHROMIUM_PATH to use a specific browser binary.
 */
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium, devices} from '@playwright/test';
import {handle} from '../tests/mock-api/handler.mjs';
import {showcase} from '../tests/mock-api/showcase.mjs';

const OUT = '.github/screenshots';
const live = process.env.BASE_URL;
const base = (live ?? 'http://localhost:4600/').replace(/\/?$/, '');
mkdirSync(OUT, {recursive: true});

// ── Local mode: a build prerendered with the showcase data, served like GitHub Pages ──
let server;
if (!live) {
  const built = spawnSync('node', ['scripts/build.mjs', '--mock', '--showcase'], {shell: true, stdio: 'inherit'});
  if (built.status !== 0) process.exit(built.status ?? 1);
  server = spawn(process.execPath, ['scripts/serve-static.mjs'], {
    env: {...process.env, BASE_HREF: '/', PORT: '4600'},
    stdio: 'ignore',
  });
  for (
    let attempt = 0;
    attempt < 50 &&
    !(await fetch(base).then(
      () => true,
      () => false
    ));
    attempt++
  ) {
    await sleep(100);
  }
}

const PALETTE = ['#F3D9C6', '#DDE8D5', '#E9DCEB', '#D6E6EE', '#F2E3B8', '#E7D3CB'];
const INK = '#6B3A22';
const SHAPES = {
  groceries: `<rect x="120" y="95" width="160" height="220" rx="28" fill="${INK}" opacity=".85"/><rect x="140" y="70" width="120" height="40" rx="10" fill="${INK}"/><rect x="140" y="170" width="120" height="70" rx="8" fill="#fff" opacity=".85"/>`,
  'home-decor': `<path d="M130 300h140l-20-120H150z" fill="${INK}" opacity=".85"/><circle cx="200" cy="130" r="60" fill="#5B7F4F"/><circle cx="160" cy="150" r="40" fill="#6E9460"/><circle cx="240" cy="150" r="40" fill="#6E9460"/>`,
  kitchen: `<rect x="110" y="130" width="150" height="170" rx="24" fill="${INK}" opacity=".85"/><path d="M260 170c50 0 50 90 0 90" stroke="${INK}" stroke-width="22" fill="none" opacity=".85"/><path d="M150 100c0-20 20-20 20-40M200 100c0-20 20-20 20-40" stroke="${INK}" stroke-width="8" fill="none" opacity=".5"/>`,
  outdoors: `<path d="M200 80l120 220H80z" fill="#3F6E5A"/><path d="M200 150l60 150H140z" fill="#fff" opacity=".35"/><rect x="60" y="300" width="280" height="16" rx="8" fill="${INK}" opacity=".6"/>`,
};

function illustration(id) {
  const product = showcase.find((item) => item.id === id) ?? showcase[0];
  const background = PALETTE[id % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${background}"/>${SHAPES[product.category] ?? SHAPES.kitchen}</svg>`;
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? {args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH} : {}
);

async function newPage(options = {}) {
  const context = await browser.newContext({serviceWorkers: 'block', ...options});
  const page = await context.newPage();
  let offline = false;
  if (!live) {
    await page.route('https://cdn.dummyjson.com/**', (route) => {
      const id = Number(new URL(route.request().url()).pathname.match(/(\d+)\.svg$/)?.[1] ?? 1);
      return route.fulfill({body: illustration(id), contentType: 'image/svg+xml'});
    });
    await page.route('https://dummyjson.com/**', async (route) => {
      if (offline) return route.abort('internetdisconnected');
      const [status, body] = handle(route.request().method(), new URL(route.request().url()), showcase);
      return route.fulfill({json: body, status});
    });
  }
  const goOffline = async () => {
    offline = true;
    await context.setOffline(true);
  };
  return {context, goOffline, page};
}

async function shot(page, name) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: `${OUT}/${name}.png`});
  console.log(`  ✓ ${name}.png`);
}

const desktop = {deviceScaleFactor: 1, viewport: {height: 900, width: 1440}};

for (const colorScheme of ['light', 'dark']) {
  const {context, page} = await newPage({...desktop, colorScheme});
  await page.goto(`${base}/`);
  await shot(page, `catalogue-${colorScheme}`);
  await context.close();
}

{
  const {context, page} = await newPage(desktop);
  await page.goto(`${base}/product/2/`);
  await shot(page, 'product');

  await page.goto(`${base}/`);
  await page.waitForLoadState('networkidle');
  for (const index of [0, 3, 12]) {
    await page
      .getByRole('button', {name: /Add to cart/})
      .nth(index)
      .click();
  }
  await page.getByRole('link', {name: /^Cart/}).click();
  await page.getByRole('button', {name: 'Increase'}).first().click();
  await page
    .getByText(/Synced at/)
    .waitFor({timeout: 5000})
    .catch(() => undefined);
  await shot(page, 'cart');
  await context.close();
}

{
  const {context, goOffline, page} = await newPage(desktop);
  await page.goto(`${base}/`);
  await page.waitForLoadState('networkidle');
  await goOffline();
  await page
    .getByRole('button', {name: /Refresh|Next/})
    .first()
    .click();
  await page.goBack().catch(() => undefined);
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: `${OUT}/offline.png`});
  console.log('  ✓ offline.png');
  await context.close();
}

for (const path of ['about', 'contact']) {
  const {context, page} = await newPage(desktop);
  await page.goto(`${base}/${path}/`);
  await shot(page, path);
  await context.close();
}

{
  const {context, page} = await newPage({...devices['Pixel 7']});
  await page.goto(`${base}/`);
  await shot(page, 'mobile');
  await context.close();
}

await browser.close();
server?.kill();
