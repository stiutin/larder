import {TestBed} from '@angular/core/testing';
import {lastValueFrom, Observable, of, throwError, toArray} from 'rxjs';

import {product, query, resetOfflineDb} from '../../../testing/fixtures';
import {ApiError} from '../../core/error/api.error';
import {catalogQueryKey} from '../model/catalog-query';
import {CatalogCache} from './catalog-cache';
import {CatalogPage, ProductApiService} from './product-api.service';
import {CatalogPageEvent, ProductRepository} from './product-repository';

function setup(api: Partial<ProductApiService>): ProductRepository {
  TestBed.configureTestingModule({providers: [{provide: ProductApiService, useValue: api}]});

  return TestBed.inject(ProductRepository);
}

const sources = async (events$: Observable<CatalogPageEvent>): Promise<string[]> =>
  (await lastValueFrom(events$.pipe(toArray()))).map((event) => (event.type === 'data' ? event.source : event.type));

const page = (...ids: number[]): Observable<CatalogPage> =>
  of({products: ids.map((id) => product(id)), total: ids.length});
const offline = (): Observable<never> => throwError(() => new ApiError('offline', 'offline'));

describe('ProductRepository — stale-while-revalidate over IndexedDB', () => {
  beforeEach(resetOfflineDb);

  it('first visit: network only, and the page is written to the cache', async () => {
    const repository = setup({getPage: () => page(1, 2)});

    expect(await sources(repository.getPage(query()))).toEqual(['network']);
    expect((await TestBed.inject(CatalogCache).getPage(catalogQueryKey(query())))?.page.products).toHaveLength(2);
  });

  it('repeat visit: cache first, then network', async () => {
    await lastValueFrom(
      setup({getPage: () => page(1)})
        .getPage(query())
        .pipe(toArray())
    );

    expect(await sources(TestBed.inject(ProductRepository).getPage(query()))).toEqual(['cache', 'network']);
  });

  it('offline with a cached page: the data stays, revalidation failure is reported', async () => {
    await lastValueFrom(setup({getPage: () => page(1)}).getPage(query()));
    TestBed.resetTestingModule();

    expect(await sources(setup({getPage: offline}).getPage(query()))).toEqual(['cache', 'revalidate-failed']);
  });

  it('offline without a cached page: the offline error reaches the UI', async () => {
    await expect(lastValueFrom(setup({getPage: offline}).getPage(query({page: 7})))).rejects.toMatchObject({
      kind: 'offline',
    });
  });

  it('a product seen before opens offline from IndexedDB', async () => {
    await lastValueFrom(setup({getPage: () => page(1)}).getPage(query()));
    TestBed.resetTestingModule();

    expect(await lastValueFrom(setup({getProduct: offline}).getProduct(1))).toMatchObject({id: 1});
  });

  it('fresh check: 404 means "removed", offline means "unknown"', async () => {
    const notFound = setup({getProduct: () => throwError(() => new ApiError('client', 'nf', 404))});
    expect(await lastValueFrom(notFound.getFreshProduct(5))).toBeNull();

    TestBed.resetTestingModule();
    expect(await lastValueFrom(setup({getProduct: offline}).getFreshProduct(5))).toBeUndefined();
  });
});
