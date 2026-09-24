import {copyFileSync, existsSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const BROWSER = join('dist', 'larder', 'browser');
const shell = join(BROWSER, 'index.csr.html');

if (!existsSync(shell)) {
  console.error(`✘ ${shell} not found - is outputMode "static" with a client-rendered route?`);
  process.exit(1);
}

copyFileSync(shell, join(BROWSER, '404.html'));
writeFileSync(join(BROWSER, '.nojekyll'), '');
writeFileSync(
  join('dist', 'larder', 'build-info.json'),
  `${JSON.stringify(
    {
      api: process.env.API_URL ?? 'https://dummyjson.com',
      baseHref: process.env.BASE_HREF || '/',
      builtAt: new Date().toISOString(),
      dataset: process.env.LARDER_DATASET ?? 'default',
      mock: process.env.LARDER_MOCK_BUILD === '1',
      publicUrl: process.env.PUBLIC_URL ?? null,
    },
    null,
    2
  )}\n`
);

console.log('✓ GitHub Pages files: 404.html, .nojekyll, build-info.json');
