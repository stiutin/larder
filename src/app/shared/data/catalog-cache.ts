import {Injectable} from '@angular/core';

import {isOfflineDbSupported, openOfflineDb} from '../../core/offline/offline-db';
import {Category, Product} from '../model/product.model';
import {CatalogPage} from './product-api.service';

export interface CachedCatalogPage {
  fetchedAt: number;
  page: CatalogPage;
}

const CATEGORIES_KEY = 'categories';

@Injectable({providedIn: 'root'})
export class CatalogCache {
  public async getPage(key: string): Promise<CachedCatalogPage | null> {
    if (!isOfflineDbSupported()) {
      return null;
    }

    try {
      const db = await openOfflineDb();
      const cached = await db.get('pages', key);

      if (!cached) {
        return null;
      }

      const products = await Promise.all(cached.productIds.map((id) => db.get('products', id)));

      if (products.some((product) => !product)) {
        return null;
      }

      return {fetchedAt: cached.fetchedAt, page: {products: products as Product[], total: cached.total}};
    } catch {
      return null;
    }
  }

  public async putPage(key: string, page: CatalogPage, fetchedAt: number): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    try {
      const db = await openOfflineDb();
      const tx = db.transaction(['pages', 'products'], 'readwrite');

      await Promise.all([
        ...page.products.map((product) => tx.objectStore('products').put(product)),
        tx.objectStore('pages').put({
          fetchedAt,
          key,
          productIds: page.products.map((product) => product.id),
          total: page.total,
        }),
        tx.done,
      ]);
    } catch {
      // Cache write failed - the app carries on, just without offline support for this page.
    }
  }

  public async getProduct(id: number): Promise<Product | null> {
    if (!isOfflineDbSupported()) {
      return null;
    }

    try {
      return (await (await openOfflineDb()).get('products', id)) ?? null;
    } catch {
      return null;
    }
  }

  public async putProduct(product: Product): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    try {
      await (await openOfflineDb()).put('products', product);
    } catch {
      // see putPage
    }
  }

  public async getCategories(): Promise<Category[] | null> {
    if (!isOfflineDbSupported()) {
      return null;
    }

    try {
      return (await (await openOfflineDb()).get('meta', CATEGORIES_KEY))?.value ?? null;
    } catch {
      return null;
    }
  }

  public async putCategories(categories: Category[], fetchedAt: number): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    try {
      await (await openOfflineDb()).put('meta', {fetchedAt, key: CATEGORIES_KEY, value: categories});
    } catch {
      // see putPage
    }
  }
}
