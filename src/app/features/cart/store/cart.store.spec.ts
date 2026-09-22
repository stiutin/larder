import {PLATFORM_ID} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';

import {product, resetOfflineDb} from '../../../../testing/fixtures';
import {API_URL} from '../../../core/http/api.config';
import {OutboxRequest, OutboxSyncService} from '../../../core/offline/outbox-sync.service';
import {ProductRepository} from '../../../shared/data/product-repository';
import {toCartItem} from '../data/cart.math';
import {CartStorage} from '../data/cart-storage';
import {CartStore} from './cart.store';

interface SyncDouble {
  deliver: ReturnType<typeof vi.fn>;
  stage: ReturnType<typeof vi.fn<(request: OutboxRequest) => Promise<void>>>;
  unstage: ReturnType<typeof vi.fn>;
}

/**
 * Every test starts from its own IndexedDB state and waits for conditions, never for fixed delays,
 * so the suite behaves the same on a fast laptop, a loaded CI runner and in watch mode with a filter.
 */
async function setup(
  options: {persisted?: ReturnType<typeof toCartItem>[]; repository?: Partial<ProductRepository>} = {}
): Promise<{cart: InstanceType<typeof CartStore>; sync: SyncDouble}> {
  await resetOfflineDb();
  if (options.persisted) {
    await new CartStorage().save(options.persisted);
  }

  const sync: SyncDouble = {
    deliver: vi.fn(async () => undefined),
    stage: vi.fn(async () => undefined),
    unstage: vi.fn(async () => undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      {provide: API_URL, useValue: 'https://api.test'},
      {provide: ProductRepository, useValue: options.repository ?? {}},
      {provide: OutboxSyncService, useValue: sync},
    ],
  });

  const cart = TestBed.inject(CartStore);
  await vi.waitFor(() => expect(cart.hydrated()).toBe(true));

  return {cart, sync};
}

describe('CartStore (SignalStore)', () => {
  it('adds, merges duplicates, clamps quantity and totals', async () => {
    const {cart} = await setup();

    cart.add(product(1));
    cart.add(product(1)); // same product: +1, not a second line
    cart.increment(1);
    cart.add(product(2, {discountPercentage: 0, price: 5}));
    cart.decrement(2); // never below 1

    expect(cart.items().map((item) => [item.productId, item.quantity])).toEqual([
      [1, 3],
      [2, 1],
    ]);
    expect(cart.totals()).toEqual({count: 4, discount: 3, subtotal: 35, total: 32});
  });

  it('stages every change durably but delivers once, after the debounce', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const {cart, sync} = await setup();

      cart.add(product(1));
      TestBed.tick();
      cart.increment(1);
      TestBed.tick();
      cart.add(product(2));
      TestBed.tick();
      await vi.waitFor(() => expect(sync.stage).toHaveBeenCalledTimes(3));
      expect(sync.deliver).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);

      expect(sync.deliver).toHaveBeenCalledTimes(1);
      expect(sync.stage.mock.lastCall?.[0].body).toEqual({
        products: [
          {id: 1, quantity: 2},
          {id: 2, quantity: 1},
        ],
        userId: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('survives a reload: hydrates from IndexedDB without re-sending an unchanged cart', async () => {
    const {cart, sync} = await setup({
      persisted: [{...toCartItem(product(1), 1), quantity: 2}, toCartItem(product(2), 2)],
    });

    TestBed.tick();

    expect(cart.items().map((item) => [item.productId, item.quantity])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(sync.stage).not.toHaveBeenCalled();
  });

  it('re-checks prices and lets the user accept the new one', async () => {
    const {cart} = await setup({
      persisted: [toCartItem(product(1), 1), toCartItem(product(2), 2)],
      repository: {getFreshProduct: (id: number) => of(id === 1 ? product(1, {price: 12}) : null)},
    });

    cart.reconcile();
    await vi.waitFor(() =>
      expect(cart.conflicts().map((conflict) => conflict.kind)).toEqual(['price-changed', 'removed'])
    );

    cart.acceptNewPrice(1);

    expect(cart.items().find((item) => item.productId === 1)?.unitPrice).toBe(12);
    expect(cart.conflicts()).toHaveLength(1);
  });

  it('stays unhydrated during prerendering, so the page and the first client render match', async () => {
    await resetOfflineDb();
    const sync = {deliver: vi.fn(), stage: vi.fn()};
    TestBed.configureTestingModule({
      providers: [
        {provide: PLATFORM_ID, useValue: 'server'},
        {provide: API_URL, useValue: 'https://api.test'},
        {provide: ProductRepository, useValue: {}},
        {provide: OutboxSyncService, useValue: sync},
      ],
    });

    const cart = TestBed.inject(CartStore);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(cart.hydrated()).toBe(false);
    expect(sync.stage).not.toHaveBeenCalled();
  });

  it('emptying the cart drops the pending snapshot instead of sending an empty cart', async () => {
    const {cart, sync} = await setup({persisted: [toCartItem(product(1), 1)]});

    cart.remove(1);
    TestBed.tick();

    await vi.waitFor(() => expect(sync.unstage).toHaveBeenCalledWith('cart-sync'));
    expect(sync.stage).not.toHaveBeenCalled();
  });
});
