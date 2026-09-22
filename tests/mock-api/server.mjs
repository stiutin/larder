/**
 * HTTP wrapper around the mock handler.
 *
 *   node tests/mock-api/server.mjs     # listens on PORT or 4100
 */
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {handle} from './handler.mjs';
import {showcase} from './showcase.mjs';

/** `dataset: 'showcase'` (or MOCK_DATASET=showcase) serves realistic products for demos; the default is for tests. */
export function startMockApi(port, dataset = process.env.MOCK_DATASET) {
  const catalogue = dataset === 'showcase' ? showcase : undefined;

  const server = createServer((request, response) => {
    const [status, body] = handle(
      request.method ?? 'GET',
      new URL(request.url ?? '/', `http://localhost:${port}`),
      catalogue
    );
    response.writeHead(status, {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'});
    response.end(JSON.stringify(body));
  });

  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4100);
  await startMockApi(port);
  console.log(`Mock API listening on http://localhost:${port}`);
}
