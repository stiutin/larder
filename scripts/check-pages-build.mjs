import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const BROWSER = join('dist', 'larder', 'browser');
const BASE = process.env.BASE_HREF ?? '/';
const problems = [];

for (const file of ['index.html', '404.html', '.nojekyll', 'ngsw.json', 'about/index.html', 'contact/index.html']) {
  if (!existsSync(join(BROWSER, file))) problems.push(`missing ${file}`);
}

const productIds = existsSync(join(BROWSER, 'product')) ? readdirSync(join(BROWSER, 'product')) : [];
const products = productIds.length;

if (products === 0) problems.push('no prerendered product pages');

const broken = productIds.filter((id) => {
  const file = join(BROWSER, 'product', id, 'index.html');
  return !existsSync(file) || readFileSync(file, 'utf8').includes('Product not found');
});
if (broken.length)
  problems.push(`${broken.length} product page(s) rendered without data: ${broken.slice(0, 10).join(', ')}`);

const catalogue = existsSync(join(BROWSER, 'index.html')) ? readFileSync(join(BROWSER, 'index.html'), 'utf8') : '';
if (!catalogue.includes('"status":"loaded"')) problems.push('the catalogue was prerendered without data');

const pages = ['index.html', '404.html', 'about/index.html', 'contact/index.html', 'cart/index.html'];
for (const page of pages.filter((file) => existsSync(join(BROWSER, file)))) {
  const html = readFileSync(join(BROWSER, page), 'utf8');
  if (!html.includes(`<base href="${BASE}">`)) problems.push(`${page}: <base href> is not ${BASE}`);
  if (BASE !== '/') {
    const rootRelative = [...html.matchAll(/(?:href|src)="(\/[^/"][^"]*)"/g)]
      .map((match) => match[1])
      .filter((url) => !url.startsWith(BASE));
    if (rootRelative.length) problems.push(`${page}: root-relative URLs ${[...new Set(rootRelative)].join(', ')}`);
  }
}

const manifest = JSON.parse(readFileSync(join(BROWSER, 'manifest.webmanifest'), 'utf8'));
if (manifest.start_url.startsWith('/') || manifest.scope.startsWith('/'))
  problems.push('manifest start_url/scope must be relative');

if (problems.length) {
  console.error(`✘ GitHub Pages build check failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ GitHub Pages build looks right: base ${BASE}, ${products} product pages`);
