import {isPlatformServer} from '@angular/common';
import {computed, effect, inject, PLATFORM_ID, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {patchState, signalStore, withComputed, withHooks, withMethods, withState} from '@ngrx/signals';
import {rxMethod} from '@ngrx/signals/rxjs-interop';
import {debounceTime, filter, forkJoin, map, pipe, Subject, switchMap, tap} from 'rxjs';

import {NetworkStatusService} from '../../../core/offline/network-status.service';
import {OutboxSyncService} from '../../../core/offline/outbox-sync.service';
import {ProductApiService} from '../../../shared/data/product-api.service';
import {ProductRepository} from '../../../shared/data/product-repository';
import {CartConflict, CartItem} from '../../../shared/model/cart.model';
import {Product} from '../../../shared/model/product.model';
import {
  cartTotals,
  clampQuantity,
  detectConflicts,
  mergeCartItems,
  toCartItem,
  toCartSyncBody,
} from '../data/cart.math';
import {CartStorage} from '../data/cart-storage';

const SYNC_DEBOUNCE_MS = 800;
const CART_OUTBOX_ID = 'cart-sync';

interface CartState {
  checking: boolean;
  conflicts: CartConflict[];
  hydrated: boolean;
  items: CartItem[];
}

const initialState: CartState = {checking: false, conflicts: [], hydrated: false, items: []};

export const CartStore = signalStore(
  {providedIn: 'root'},
  withState(initialState),
  withComputed(({items}) => {
    const totals = computed(() => cartTotals(items()));

    return {
      count: computed(() => totals().count),
      isEmpty: computed(() => items().length === 0),
      productIds: computed(() => items().map((item) => item.productId)),
      totals,
    };
  }),
  withMethods((store, repository = inject(ProductRepository), network = inject(NetworkStatusService)) => {
    const updateItem = (productId: number, update: (item: CartItem) => CartItem): void => {
      patchState(store, {
        items: store.items().map((item) => (item.productId === productId ? update(item) : item)),
      });
    };

    const dropConflict = (productId: number): void => {
      patchState(store, {conflicts: store.conflicts().filter((conflict) => conflict.productId !== productId)});
    };

    return {
      add(product: Product): void {
        if (store.items().some((item) => item.productId === product.id)) {
          updateItem(product.id, (item) => ({...item, quantity: clampQuantity(item.quantity + 1, item)}));

          return;
        }

        patchState(store, {items: [...store.items(), toCartItem(product, Date.now())]});
      },
      increment(productId: number): void {
        updateItem(productId, (item) => ({...item, quantity: clampQuantity(item.quantity + 1, item)}));
      },
      decrement(productId: number): void {
        updateItem(productId, (item) => ({...item, quantity: clampQuantity(item.quantity - 1, item)}));
      },
      remove(productId: number): void {
        patchState(store, {items: store.items().filter((item) => item.productId !== productId)});
        dropConflict(productId);
      },
      acceptNewPrice(productId: number): void {
        const conflict = store.conflicts().find((item) => item.productId === productId);

        if (conflict?.kind === 'price-changed') {
          updateItem(productId, (item) => ({...item, unitPrice: conflict.newPrice}));
        }

        dropConflict(productId);
      },
      reconcile: rxMethod<void>(
        pipe(
          filter(() => network.online() && store.items().length > 0),
          tap(() => patchState(store, {checking: true})),
          switchMap(() =>
            forkJoin(
              store
                .items()
                .map((item) =>
                  repository.getFreshProduct(item.productId).pipe(map((fresh) => [item.productId, fresh] as const))
                )
            )
          ),
          tap((entries) =>
            patchState(store, {checking: false, conflicts: detectConflicts(store.items(), new Map(entries))})
          )
        )
      ),
      hydrate(items: CartItem[]): void {
        patchState(store, {hydrated: true, items: mergeCartItems(items, store.items())});
      },
    };
  }),
  withHooks((store) => {
    const storage = inject(CartStorage);
    const sync = inject(OutboxSyncService);
    const api = inject(ProductApiService);
    const network = inject(NetworkStatusService);
    const platformId = inject(PLATFORM_ID);

    return {
      onInit(): void {
        if (isPlatformServer(platformId)) {
          return;
        }

        let lastStagedBody = '';
        let wasOnline = network.online();
        const changes$ = new Subject<void>();

        void storage.load().then((persisted) => {
          store.hydrate(persisted);
          lastStagedBody = JSON.stringify(toCartSyncBody(store.items()));
        });

        effect(() => {
          const items = store.items();

          if (!store.hydrated()) {
            return;
          }

          untracked(() => {
            void storage.save(items);

            const body = toCartSyncBody(items);
            const serialized = JSON.stringify(body);

            if (serialized === lastStagedBody) {
              return;
            }

            lastStagedBody = serialized;

            if (items.length === 0) {
              void sync.unstage(CART_OUTBOX_ID);

              return;
            }

            void sync
              .stage({body, id: CART_OUTBOX_ID, method: 'POST', url: api.cartSyncUrl()})
              .then(() => changes$.next());
          });
        });

        changes$.pipe(debounceTime(SYNC_DEBOUNCE_MS), takeUntilDestroyed()).subscribe(() => void sync.deliver());

        effect(() => {
          const online = network.online();

          untracked(() => {
            if (online && !wasOnline && store.hydrated()) {
              store.reconcile();
            }

            wasOnline = online;
          });
        });
      },
    };
  })
);
