import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, extname, basename} from 'node:path';
import {gzipSync, brotliCompressSync, constants} from 'node:zlib';

const DIST = process.env.DIST_DIR ?? 'dist/larder/browser';
const MEASURED = ['.js', '.css'];

if (!existsSync(DIST)) {
  console.error(`${DIST} not found. Run npm run build first`);
  process.exit(1);
}

const gzip = (buf) => gzipSync(buf, {level: 9}).length;
const brotli = (buf) => brotliCompressSync(buf, {params: {[constants.BROTLI_PARAM_QUALITY]: 11}}).length;
const stableName = (name) => name.replace(/^(main|styles|polyfills)-[A-Za-z0-9_]{8}(?=\.[a-z]+$)/, '$1');
const SERVICE_WORKER_FILES = new Set(['ngsw-worker.js', 'safety-worker.js', 'worker-basic.min.js', 'sw-sync.js']);

const files = readdirSync(DIST)
  .filter((f) => MEASURED.includes(extname(f)) && !SERVICE_WORKER_FILES.has(f))
  .map((f) => {
    const buf = readFileSync(join(DIST, f));
    return {
      file: basename(f),
      name: stableName(basename(f)),
      raw: statSync(join(DIST, f)).size,
      gzip: gzip(buf),
      brotli: brotli(buf),
    };
  })
  .sort((a, b) => b.raw - a.raw);

const indexFile = ['index.csr.html', 'index.html'].map((name) => join(DIST, name)).find((path) => existsSync(path));
const indexHtml = indexFile ? readFileSync(indexFile, 'utf8') : '';
const initialNames = new Set(
  [...indexHtml.matchAll(/(?:href|src)="([^"]+\.(?:js|css))"/g)].map((match) => basename(match[1]))
);
const isLazy = (file) => !initialNames.has(file);

const sum = (list) =>
  list.reduce((acc, f) => ({raw: acc.raw + f.raw, gzip: acc.gzip + f.gzip, brotli: acc.brotli + f.brotli}), {
    raw: 0,
    gzip: 0,
    brotli: 0,
  });

const initialFiles = files.filter((f) => !isLazy(f.file));
const lazyFiles = files.filter((f) => isLazy(f.file));
const total = sum(initialFiles);
const lazyTotal = sum(lazyFiles);

const kb = (n) => `${(n / 1000).toFixed(2)} kB`;
const pad = (s, n) => String(s).padEnd(n);

console.log(`\n${pad('File', 28)}${pad('raw', 12)}${pad('gzip', 12)}brotli`);
console.log('-'.repeat(60));
for (const f of files) {
  console.log(`${pad(f.name, 28)}${pad(kb(f.raw), 12)}${pad(kb(f.gzip), 12)}${kb(f.brotli)}`);
}
console.log('-'.repeat(60));
console.log(`${pad('Initial total', 28)}${pad(kb(total.raw), 12)}${pad(kb(total.gzip), 12)}${kb(total.brotli)}`);
if (lazyFiles.length) {
  console.log(
    `${pad('Lazy total', 28)}${pad(kb(lazyTotal.raw), 12)}${pad(kb(lazyTotal.gzip), 12)}${kb(lazyTotal.brotli)}`
  );
}

console.log(`\nFiles: ${files.length}, lazy chunks: ${lazyFiles.length}\n`);

if (process.argv.includes('--json')) {
  const out = join('dist', 'larder', 'bundle-report.json');
  writeFileSync(
    out,
    `${JSON.stringify({files, initialTotal: total, lazyChunks: lazyFiles.length, lazyTotal, measuredAt: new Date().toISOString()}, null, 2)}\n`
  );
  console.log(`Written to ${out}\n`);
}
