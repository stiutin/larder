import {DBSchema, IDBPDatabase, openDB} from 'idb';

import {CartItem} from '../../shared/model/cart.model';
import {Category, Product} from '../../shared/model/product.model';

export const OFFLINE_DB_NAME = 'larder-offline';
export const OFFLINE_DB_VERSION = 1;

export interface CachedPage {
  fetchedAt: number;
  key: string;
  productIds: number[];
  total: number;
}

export interface OutboxEntry {
  attempts: number;
  body: unknown;
  createdAt: number;
  id: string;
  method: 'POST' | 'PUT';
  url: string;
}

export interface PersistedCart {
  id: 'cart';
  items: CartItem[];
  updatedAt: number;
}

interface OfflineSchema extends DBSchema {
  cart: {key: string; value: PersistedCart};
  meta: {key: string; value: {fetchedAt: number; key: string; value: Category[]}};
  outbox: {key: string; value: OutboxEntry};
  pages: {key: string; value: CachedPage};
  products: {key: number; value: Product};
}

export type OfflineDb = IDBPDatabase<OfflineSchema>;

let connection: Promise<OfflineDb> | null = null;

export function openOfflineDb(): Promise<OfflineDb> {
  connection ??= openDB<OfflineSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
    blocking(_currentVersion, _blockedVersion, event) {
      (event.target as IDBDatabase).close();
      connection = null;
    },
    upgrade(db) {
      db.createObjectStore('products', {keyPath: 'id'});
      db.createObjectStore('pages', {keyPath: 'key'});
      db.createObjectStore('meta', {keyPath: 'key'});
      db.createObjectStore('cart', {keyPath: 'id'});
      db.createObjectStore('outbox', {keyPath: 'id'});
    },
  });

  return connection;
}

/** IndexedDB may be unavailable (Firefox private mode, SSR). The offline layer then switches off silently. */
export function isOfflineDbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function resetOfflineDbConnection(): Promise<void> {
  if (connection) {
    (await connection).close();
    connection = null;
  }
}
