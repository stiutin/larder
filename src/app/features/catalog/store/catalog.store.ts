import {isPlatformServer} from '@angular/common';
import {computed, inject, PLATFORM_ID, TransferState} from '@angular/core';
import {
  getState,
  patchState,
  signalMethod,
  signalStore,
  watchState,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {upsertEntities, upsertEntity, withEntities} from '@ngrx/signals/entities';
import {rxMethod} from '@ngrx/signals/rxjs-interop';
import {catchError, EMPTY, exhaustMap, filter, pipe, Subject, switchMap, tap} from 'rxjs';

import {ApiError} from '../../../core/error/api.error';
import {CatalogCache} from '../../../shared/data/catalog-cache';
import {CatalogPageEvent, ProductRepository} from '../../../shared/data/product-repository';
import {CatalogQuery, catalogQueryKey, pageCount} from '../../../shared/model/catalog-query';
import {Product} from '../../../shared/model/product.model';
import {CatalogStatus, initialCatalogState} from './catalog.state';
import {CATALOG_TRANSFER_KEY} from './catalog-transfer';

interface PageRequest {
  /** `true` for an explicit retry: reload even if this query is already on screen. */
  force: boolean;
  query: CatalogQuery;
  /** Refresh in the background: keep the current page on screen instead of showing the loading state. */
  silent?: boolean;
}

/** Statuses in which the current page is on screen and does not need to be fetched again. */
const ON_SCREEN: ReadonlySet<CatalogStatus> = new Set(['loaded', 'revalidating', 'stale']);

const toApiError = (error: unknown): ApiError =>
  error instanceof ApiError ? error : new ApiError('client', String(error));

/**
 * Catalogue state: one SignalStore instead of actions, reducer, effects and selectors.
 *
 * Provided at the lazy catalogue route, so it — and the whole data layer behind it — stays out of the initial bundle.
 * Page requests go through one stream with `switchMap`: a newer query (typing, paging, sorting) cancels the older one.
 */
export const CatalogStore = signalStore(
  withEntities<Product>(),
  withState(initialCatalogState),
  withProps(() => ({
    _requests$: new Subject<PageRequest>(),
    _repository: inject(ProductRepository),
  })),
  withComputed(({entityMap, pageIds, query, status, total}) => ({
    hasFilters: computed(() => Boolean(query().search || query().category)),
    isInitialLoading: computed(() => status() === 'idle' || status() === 'loading'),
    pageCount: computed(() => pageCount(total())),
    pageProducts: computed(() =>
      pageIds()
        .map((id) => entityMap()[id])
        .filter((product): product is Product => product !== undefined)
    ),
  })),
  withMethods((store) => {
    const applyEvent = (event: CatalogPageEvent): void => {
      if (event.type === 'revalidate-failed') {
        // The cached page stays on screen; the UI says how old it is.
        patchState(store, {error: event.error, status: 'stale'});

        return;
      }

      patchState(store, upsertEntities(event.page.products), {
        error: null,
        fetchedAt: event.fetchedAt,
        pageIds: event.page.products.map((product) => product.id),
        source: event.source,
        status: event.source === 'cache' ? 'revalidating' : 'loaded',
        total: event.page.total,
      });
    };

    const isOnScreen = (query: CatalogQuery): boolean =>
      catalogQueryKey(store.query()) === catalogQueryKey(query) && ON_SCREEN.has(store.status());

    return {
      /** The single page-loading pipeline. Started once from `onInit`. */
      _loadPages: rxMethod<PageRequest>(
        pipe(
          // Coming back from a product page must not reload a list that is already shown.
          filter(({force, query}) => force || !isOnScreen(query)),
          tap(({query, silent}) => {
            if (!silent) {
              patchState(store, {error: null, pageIds: [], query, status: 'loading'});
            }
          }),
          switchMap(({query}) =>
            store._repository.getPage(query).pipe(
              tap(applyEvent),
              catchError((error: unknown) => {
                patchState(store, {error: toApiError(error), status: 'error'});

                return EMPTY;
              })
            )
          )
        )
      ),

      /** Binds the store to a query signal (the URL). Every change of the signal requests a page. */
      connectQuery: signalMethod<CatalogQuery>((query) => store._requests$.next({force: false, query})),

      retry(): void {
        store._requests$.next({force: true, query: store.query()});
      },

      loadCategories: rxMethod<void>(
        pipe(
          exhaustMap(() =>
            store._repository.getCategories().pipe(
              tap((categories) => patchState(store, {categories})),
              // Without categories the catalogue still works — the filter just does not appear.
              catchError(() => EMPTY)
            )
          )
        )
      ),

      upsertProduct(product: Product): void {
        patchState(store, upsertEntity(product));
      },
    };
  }),
  withHooks((store) => {
    const transferState = inject(TransferState);
    const isServer = isPlatformServer(inject(PLATFORM_ID));
    const cache = inject(CatalogCache);

    return {
      onInit(): void {
        store._loadPages(store._requests$);

        if (isServer) {
          // Hand the loaded state to the client (see catalog-transfer.ts).
          watchState(store, (state) => {
            if (state.status === 'loaded') {
              transferState.set(CATALOG_TRANSFER_KEY, {...getState(store), error: null});
            }
          });

          return;
        }

        const snapshot = transferState.get(CATALOG_TRANSFER_KEY, null);

        if (snapshot) {
          transferState.remove(CATALOG_TRANSFER_KEY);
          patchState(store, snapshot);
          void cache.putPage(
            catalogQueryKey(snapshot.query),
            {products: store.pageProducts(), total: snapshot.total},
            snapshot.fetchedAt ?? Date.now()
          );
          // The snapshot was taken at build time (the site is prerendered), so refresh it quietly.
          store._requests$.next({force: true, query: snapshot.query, silent: true});
        }
      },
    };
  })
);
