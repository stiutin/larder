import {test as base, expect, Request} from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain ESM helper shared with the SSR tests
import {handle} from '../tests/mock-api/handler.mjs';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64'
);

interface Network {
  goOffline: () => Promise<void>;
  goOnline: () => Promise<void>;
}

interface Fixtures {
  /** Offline emulation that also stops the mock routes from answering. */
  network: Network;
  /** Every write request the browser sent to the API during the test. */
  writes: Request[];
}

let offline = false;

/**
 * Browser-side requests to dummyjson are answered by the same mock the SSR server uses,
 * so server-rendered HTML and client revalidation always agree. Product images get a 1×1 PNG.
 */
export const test = base.extend<Fixtures>({
  writes: async ({page}, use) => {
    const writes: Request[] = [];

    await page.route('https://cdn.dummyjson.com/**', (route) => route.fulfill({body: PIXEL, contentType: 'image/png'}));
    offline = false;
    await page.route('https://dummyjson.com/**', async (route) => {
      const request = route.request();
      if (offline) {
        return route.abort('internetdisconnected');
      }
      if (request.method() !== 'GET') {
        writes.push(request);
      }
      const [status, body] = handle(request.method(), new URL(request.url())) as [number, unknown];
      await route.fulfill({contentType: 'application/json', json: body, status});
    });

    await use(writes);
  },
  network: async ({context}, use) => {
    await use({
      goOffline: async () => {
        offline = true;
        await context.setOffline(true);
      },
      goOnline: async () => {
        offline = false;
        await context.setOffline(false);
      },
    });
  },
});

export {expect};
