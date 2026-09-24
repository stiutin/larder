import {Injectable} from '@angular/core';
import * as v from 'valibot';

import {isOfflineDbSupported, openOfflineDb} from '../../../core/offline/offline-db';
import {CartItem} from '../../../shared/model/cart.model';

const persistedItemsSchema = v.array(
  v.object({
    addedAt: v.number(),
    category: v.string(),
    discountPercentage: v.number(),
    productId: v.number(),
    quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
    stock: v.number(),
    thumbnail: v.string(),
    title: v.string(),
    unitPrice: v.number(),
  })
);

@Injectable({providedIn: 'root'})
export class CartStorage {
  public async load(): Promise<CartItem[]> {
    if (!isOfflineDbSupported()) {
      return [];
    }

    try {
      const persisted = await (await openOfflineDb()).get('cart', 'cart');
      const result = v.safeParse(persistedItemsSchema, persisted?.items ?? []);

      return result.success ? result.output : [];
    } catch {
      return [];
    }
  }

  public async save(items: CartItem[]): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    try {
      await (await openOfflineDb()).put('cart', {id: 'cart', items, updatedAt: Date.now()});
    } catch {
      // The cart stays in memory until reload - better than crashing.
    }
  }
}
