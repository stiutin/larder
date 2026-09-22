/* eslint-disable */
/**
 * The app Service Worker = the standard ngsw-worker + Background Sync for the outbox queue.
 *
 * ngsw-worker caches static assets per ngsw-config.json and handles updates (SwUpdate).
 * This file adds exactly one thing: when the browser reports the network is back (`sync` event),
 * send everything in the outbox — even if the tab has already been closed.
 *
 * IMPORTANT: the database name, version and stores must match src/app/core/offline/offline-db.ts.
 * The bundler never reaches this file, so there is no shared module.
 */
importScripts('./ngsw-worker.js');

const DB_NAME = 'larder-offline';
const DB_VERSION = 1;
const OUTBOX = 'outbox';
const SYNC_TAG = 'outbox-sync';

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOutbox());
  }
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // If the SW opens the database first, create the same schema the app would.
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, keyPath] of [
        ['products', 'id'],
        ['pages', 'key'],
        ['meta', 'key'],
        ['cart', 'id'],
        ['outbox', 'id'],
      ]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, {keyPath});
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // The app may need to upgrade or delete the database: never hold it open against a newer version.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function run(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX, mode);
    const request = action(tx.objectStore(OUTBOX));
    tx.oncomplete = () => resolve(request && request.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function flushOutbox() {
  const db = await openDb();
  const entries = await run(db, 'readonly', (store) => store.getAll());

  for (const entry of entries) {
    const response = await fetch(entry.url, {
      body: JSON.stringify(entry.body),
      headers: {'Content-Type': 'application/json'},
      method: entry.method,
    });

    // A 4xx other than timeouts and rate limits will never succeed: drop it (same rule as the app).
    const permanent = response.status >= 400 && response.status < 500 && ![408, 425, 429].includes(response.status);

    // Otherwise throw — the browser retries the sync later with exponential backoff.
    if (!response.ok && !permanent) {
      throw new Error(`Outbox sync failed: ${response.status}`);
    }

    // Delete only if the entry was not overwritten while in flight.
    const current = await run(db, 'readonly', (store) => store.get(entry.id));
    if (current && current.createdAt === entry.createdAt) {
      await run(db, 'readwrite', (store) => store.delete(entry.id));
    }
  }

  const clients = await self.clients.matchAll({includeUncontrolled: true});
  for (const client of clients) {
    client.postMessage({at: Date.now(), type: 'outbox-flushed'});
  }
}
