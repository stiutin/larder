import {TestBed} from '@angular/core/testing';

import {product, resetOfflineDb} from '../../../../testing/fixtures';
import {openOfflineDb, PersistedCart} from '../../../core/offline/offline-db';
import {toCartItem} from './cart.math';
import {CartStorage} from './cart-storage';

describe('CartStorage', () => {
  beforeEach(resetOfflineDb);

  it('saves and restores the cart', async () => {
    const storage = TestBed.inject(CartStorage);
    const items = [toCartItem(product(1), 1)];

    await storage.save(items);

    expect(await storage.load()).toEqual(items);
  });

  it('drops data from an incompatible older version instead of crashing', async () => {
    const broken = {id: 'cart', items: [{productId: 'oops'}], updatedAt: 0} as unknown as PersistedCart;
    await (await openOfflineDb()).put('cart', broken);

    expect(await TestBed.inject(CartStorage).load()).toEqual([]);
  });
});
