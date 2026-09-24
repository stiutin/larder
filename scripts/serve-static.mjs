import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve} from 'node:path';

const ROOT = resolve('dist', 'larder', 'browser');
const BASE = process.env.BASE_HREF ?? '/';
const PORT = Number(process.env.PORT ?? 4000);

const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function send(response, status, file) {
  response.writeHead(status, {'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream'});
  createReadStream(file).pipe(response);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const notFound = () => send(response, 404, join(ROOT, '404.html'));

  if (!url.pathname.startsWith(BASE)) {
    return notFound();
  }

  const relative = decodeURIComponent(url.pathname.slice(BASE.length));
  const file = normalize(join(ROOT, relative));
  if (!file.startsWith(ROOT)) {
    return notFound();
  }

  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      response.writeHead(301, {Location: `${url.pathname}/${url.search}`});
      return response.end();
    }
    const index = join(file, 'index.html');
    return existsSync(index) ? send(response, 200, index) : notFound();
  }

  return existsSync(file) ? send(response, 200, file) : notFound();
});

server.listen(PORT, () =>
  console.log(`Static site (GitHub Pages emulation) listening on http://localhost:${PORT}${BASE}`)
);
