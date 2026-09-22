import {inject, Injectable} from '@angular/core';
import {catchError, concat, defer, EMPTY, from, map, Observable, of, switchMap, tap, throwError} from 'rxjs';

import {ApiError} from '../../core/error/api.error';
import {CatalogQuery, catalogQueryKey} from '../model/catalog-query';
import {Category, Product} from '../model/product.model';
import {CatalogCache} from './catalog-cache';
import {CatalogPage, ProductApiService} from './product-api.service';

export type DataSource = 'cache' | 'network';

export type CatalogPageEvent =
  | {fetchedAt: number; page: CatalogPage; source: DataSource; type: 'data'}
  | {error: ApiError; type: 'revalidate-failed'};

const HTTP_NOT_FOUND = 404;

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('client', String(error));
}

/**
 * Stale-while-revalidate on top of the API and IndexedDB.
 *
 * Cache first (instant, even offline), then network. `concat` guarantees the order:
 * fresh data is never overwritten by stale data, even if the network answers faster than the disk.
 */
@Injectable({providedIn: 'root'})
export class ProductRepository {
  private readonly api = inject(ProductApiService);
  private readonly cache = inject(CatalogCache);

  public getPage(query: CatalogQuery): Observable<CatalogPageEvent> {
    const key = catalogQueryKey(query);

    return defer(() => {
      let servedFromCache = false;

      const cached$ = from(this.cache.getPage(key)).pipe(
        switchMap((cached) => (cached ? of(cached) : EMPTY)),
        tap(() => (servedFromCache = true)),
        map((cached): CatalogPageEvent => ({...cached, source: 'cache', type: 'data'}))
      );

      const network$ = this.api.getPage(query).pipe(
        switchMap((page) => {
          const fetchedAt = Date.now();

          return from(this.cache.putPage(key, page, fetchedAt)).pipe(
            map((): CatalogPageEvent => ({fetchedAt, page, source: 'network', type: 'data'}))
          );
        }),
        catchError((error: unknown) =>
          // Cache is already on screen — a network error must not remove it.
          servedFromCache
            ? of<CatalogPageEvent>({error: toApiError(error), type: 'revalidate-failed'})
            : throwError(() => toApiError(error))
        )
      );

      return concat(cached$, network$);
    });
  }

  /** For the product page: cache first, because even a stale product beats an empty page offline. */
  public getProduct(id: number): Observable<Product | null> {
    return from(this.cache.getProduct(id)).pipe(
      switchMap((cached) =>
        cached
          ? of(cached)
          : this.api.getProduct(id).pipe(
              tap((product) => void this.cache.putProduct(product)),
              catchError(() => of(null))
            )
      )
    );
  }

  /**
   * Network only — for cart reconciliation. `null` means the product is gone (404),
   * `undefined` means the check failed (offline, 500) and no decision can be made.
   */
  public getFreshProduct(id: number): Observable<Product | null | undefined> {
    return this.api.getProduct(id).pipe(
      tap((product) => void this.cache.putProduct(product)),
      catchError((error: unknown) =>
        of(error instanceof ApiError && error.status === HTTP_NOT_FOUND ? null : undefined)
      )
    );
  }

  public getCategories(): Observable<Category[]> {
    return from(this.cache.getCategories()).pipe(
      switchMap((cached) => {
        const network$ = this.api.getCategories().pipe(
          tap((categories) => void this.cache.putCategories(categories, Date.now())),
          catchError((error: unknown) => (cached ? EMPTY : throwError(() => toApiError(error))))
        );

        return cached ? concat(of(cached), network$) : network$;
      })
    );
  }
}
