import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';

import {OFFLINE_DB_NAME} from './app/core/offline/offline-db';
import {openOfflineDb} from './app/core/offline/offline-db';
import {resetOfflineDb} from './testing/fixtures';

interface SyncEvent {
  tag: string;
  waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * `sw-sync.js` runs inside a Service Worker and never passes through the bundler,
 * so it is executed here in a VM with the same (fake) IndexedDB the app writes to.
 */
function loadWorker(
  respondOk: () => boolean,
  failureStatus = 503
): {
  fire: (tag: string) => Promise<unknown> | undefined;
  posted: unknown[];
  sent: unknown[];
} {
  const listeners: Record<string, (event: SyncEvent) => void> = {};
  const posted: unknown[] = [];
  const sent: unknown[] = [];

  runInNewContext(readFileSync(join(process.cwd(), 'src/sw-sync.js'), 'utf8'), {
    console,
    Date,
    Error,
    fetch: async (_url: string, init: {body: string}) => {
      sent.push(JSON.parse(init.body));

      return {ok: respondOk(), status: respondOk() ? 200 : failureStatus};
    },
    importScripts: () => undefined,
    indexedDB,
    JSON,
    Promise,
    self: {
      addEventListener: (type: string, listener: (event: SyncEvent) => void) => (listeners[type] = listener),
      clients: {matchAll: async () => [{postMessage: (message: unknown) => posted.push(message)}]},
    },
  });

  const fire = (tag: string): Promise<unknown> | undefined => {
    let pending: Promise<unknown> | undefined;
    listeners['sync']?.({tag, waitUntil: (promise) => (pending = promise)});

    return pending;
  };

  return {fire, posted, sent};
}

describe('sw-sync.js (Background Sync handler)', () => {
  beforeEach(resetOfflineDb);

  it('uses the same database name as the app', () => {
    expect(readFileSync(join(process.cwd(), 'src/sw-sync.js'), 'utf8')).toContain(`'${OFFLINE_DB_NAME}'`);
  });

  it('keeps the entry when the server is down, delivers it later and notifies open tabs', async () => {
    let ok = false;
    const worker = loadWorker(() => ok);
    const db = await openOfflineDb();
    await db.put('outbox', {
      attempts: 0,
      body: {products: [{id: 1, quantity: 2}]},
      createdAt: 1,
      id: 'cart-sync',
      method: 'POST',
      url: 'https://api.test/carts/add',
    });

    await expect(worker.fire('outbox-sync')).rejects.toThrow(); // the browser retries sync with backoff
    expect(await db.getAll('outbox')).toHaveLength(1);

    ok = true;
    await worker.fire('outbox-sync');
    expect(await db.getAll('outbox')).toEqual([]);
    expect(worker.sent.at(-1)).toMatchObject({products: [{id: 1, quantity: 2}]});
    expect(worker.posted.at(-1)).toMatchObject({type: 'outbox-flushed'});
  });

  it('ignores other sync tags', () => {
    expect(loadWorker(() => true).fire('something-else')).toBeUndefined();
  });

  it('drops an entry the server rejects (400) instead of retrying it forever', async () => {
    const worker = loadWorker(() => false, 400);
    const db = await openOfflineDb();
    await db.put('outbox', {
      attempts: 0,
      body: {products: []},
      createdAt: 1,
      id: 'cart-sync',
      method: 'POST',
      url: 'https://api.test/carts/add',
    });

    await worker.fire('outbox-sync');

    expect(await db.getAll('outbox')).toEqual([]);
  });
});
