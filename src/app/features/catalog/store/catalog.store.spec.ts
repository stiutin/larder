import {signal, TransferState} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {delay, Observable, of, throwError} from 'rxjs';

import {product, query, resetOfflineDb} from '../../../../testing/fixtures';
import {ApiError} from '../../../core/error/api.error';
import {CatalogPageEvent, ProductRepository} from '../../../shared/data/product-repository';
import {CatalogQuery} from '../../../shared/model/catalog-query';
import {initialCatalogState} from './catalog.state';
import {CatalogStore} from './catalog.store';
import {CATALOG_TRANSFER_KEY, CatalogSnapshot} from './catalog-transfer';

type Store = InstanceType<typeof CatalogStore>;

function setup(repository: Partial<ProductRepository>): Store {
  TestBed.configureTestingModule({
    providers: [CatalogStore, {provide: ProductRepository, useValue: {getCategories: () => of([]), ...repository}}],
  });

  return TestBed.inject(CatalogStore);
}

const data = (source: 'cache' | 'network', ids: number[], price = 10): CatalogPageEvent => ({
  fetchedAt: 1,
  page: {products: ids.map((id) => product(id, {price})), total: ids.length},
  source,
  type: 'data',
});

/** `connectQuery` is a signalMethod: it reacts to the signal inside the store's injection context. */
function connect(store: Store, initial: CatalogQuery): ReturnType<typeof signal<CatalogQuery>> {
  const current = signal(initial);
  store.connectQuery(current);
  TestBed.tick();

  return current;
}

describe('CatalogStore (SignalStore)', () => {
  beforeEach(resetOfflineDb);

  it('stale-while-revalidate: cache then network, fresh data wins', () => {
    const store = setup({getPage: () => of(data('cache', [1]), data('network', [1, 2], 11))});
    expect(store.status()).toBe('idle');

    connect(store, query());

    expect(store.status()).toBe('loaded');
    expect(store.pageProducts().map((item) => item.id)).toEqual([1, 2]);
    expect(store.entityMap()[1]?.price).toBe(11);
    expect(store.pageCount()).toBe(1);
  });

  it('switchMap: a newer query cancels the slower older one', async () => {
    const store = setup({
      getPage: (request: CatalogQuery): Observable<CatalogPageEvent> =>
        of(data('network', [request.page * 100])).pipe(delay(request.page === 1 ? 40 : 5)),
    });

    const current = connect(store, query({page: 1}));
    current.set(query({page: 2}));
    TestBed.tick();

    await vi.waitFor(() => expect(store.pageIds()).toEqual([200]));
    // Give the cancelled page-1 response time to arrive: it must never overwrite page 2.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(store.pageIds()).toEqual([200]);
    expect(store.query().page).toBe(2);
  });

  it('does not refetch a page that is already on screen, but retry() forces it', () => {
    const getPage = vi.fn(() => of(data('network', [1])));
    const store = setup({getPage});

    const current = connect(store, query());
    current.set({...query()}); // same key, new object — e.g. coming back from a product page
    TestBed.tick();
    expect(getPage).toHaveBeenCalledTimes(1);

    store.retry();
    expect(getPage).toHaveBeenCalledTimes(2);
  });

  it('offline without cache ends in an error the UI can explain', () => {
    const store = setup({getPage: () => throwError(() => new ApiError('offline', 'offline'))});

    connect(store, query());

    expect(store.status()).toBe('error');
    expect(store.error()?.kind).toBe('offline');
    expect(store.isInitialLoading()).toBe(false);
  });

  it('keeps the cached page on screen when revalidation fails', () => {
    const store = setup({
      getPage: () =>
        of(data('cache', [1]), {error: new ApiError('offline', 'x'), type: 'revalidate-failed'} as CatalogPageEvent),
    });

    connect(store, query());

    expect(store.status()).toBe('stale');
    expect(store.pageIds()).toEqual([1]);
  });

  it('loads categories and flags active filters', () => {
    const store = setup({
      getCategories: () => of([{name: 'Laptops', slug: 'laptops'}]),
      getPage: () => of(data('network', [])),
    });

    store.loadCategories();
    connect(store, query({category: 'laptops'}));

    expect(store.categories()).toEqual([{name: 'Laptops', slug: 'laptops'}]);
    expect(store.hasFilters()).toBe(true);
  });

  it('starts from the prerendered snapshot and refreshes it quietly, without a loading state', async () => {
    const statuses: string[] = [];
    const getPage = vi.fn(() => of(data('network', [1, 2], 12)));
    TestBed.configureTestingModule({
      providers: [CatalogStore, {provide: ProductRepository, useValue: {getCategories: () => of([]), getPage}}],
    });
    const snapshot: CatalogSnapshot = {
      ...initialCatalogState,
      entityMap: {1: product(1)},
      fetchedAt: 1,
      ids: [1],
      pageIds: [1],
      source: 'network',
      status: 'loaded',
      total: 1,
    };
    TestBed.inject(TransferState).set(CATALOG_TRANSFER_KEY, snapshot);

    const store = TestBed.inject(CatalogStore);
    const watcher = setInterval(() => statuses.push(store.status()), 1);

    // The build-time data is replaced by fresh data without ever showing a skeleton.
    await vi.waitFor(() => expect(store.pageIds()).toEqual([1, 2]));
    clearInterval(watcher);
    expect(getPage).toHaveBeenCalledTimes(1);
    expect(statuses).not.toContain('loading');
    expect(store.entityMap()[1]?.price).toBe(12);
    expect(TestBed.inject(TransferState).hasKey(CATALOG_TRANSFER_KEY)).toBe(false);
  });
});
