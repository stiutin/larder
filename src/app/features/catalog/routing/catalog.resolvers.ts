import {inject} from '@angular/core';
import {ResolveFn} from '@angular/router';
import {map, Observable, of, tap} from 'rxjs';

import {ProductRepository} from '../../../shared/data/product-repository';
import {Product} from '../../../shared/model/product.model';
import {CatalogStore} from '../store/catalog.store';

/**
 * The product is looked up in order: store → IndexedDB → network.
 * Direct entry to /product/:id works before the catalogue was ever loaded, and offline if the product was seen before.
 */
export const productResolver: ResolveFn<Product | undefined> = (route): Observable<Product | undefined> => {
  const catalog = inject(CatalogStore);
  const repository = inject(ProductRepository);
  const productId = Number(route.paramMap.get('id'));

  if (!Number.isInteger(productId) || productId <= 0) {
    return of(undefined);
  }

  const fromStore = catalog.entityMap()[productId];

  if (fromStore) {
    return of(fromStore);
  }

  return repository.getProduct(productId).pipe(
    tap((product) => {
      if (product) {
        catalog.upsertProduct(product);
      }
    }),
    map((product) => product ?? undefined)
  );
};
