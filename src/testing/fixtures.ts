import {OFFLINE_DB_NAME, resetOfflineDbConnection} from '../app/core/offline/offline-db';
import {CatalogQuery, DEFAULT_CATALOG_QUERY} from '../app/shared/model/catalog-query';
import {Product} from '../app/shared/model/product.model';

export function product(id: number, overrides: Partial<Product> = {}): Product {
  return {
    category: 'smartphones',
    description: `Description ${id}`,
    discountPercentage: 10,
    id,
    price: 10,
    rating: 4.5,
    stock: 3,
    thumbnail: `https://cdn.dummyjson.com/test/${id}.webp`,
    title: `Product ${id}`,
    ...overrides,
  };
}

export function query(overrides: Partial<CatalogQuery> = {}): CatalogQuery {
  return {...DEFAULT_CATALOG_QUERY, ...overrides};
}

/** Wipes IndexedDB between specs so they do not see each other's cache. */
export async function resetOfflineDb(): Promise<void> {
  await resetOfflineDbConnection();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
    request.onsuccess = request.onerror = (): void => resolve();
  });
}
