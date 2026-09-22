import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, convertToParamMap, RouterStateSnapshot} from '@angular/router';
import {firstValueFrom, isObservable, Observable, of} from 'rxjs';

import {product} from '../../../../testing/fixtures';
import {ProductRepository} from '../../../shared/data/product-repository';
import {Product} from '../../../shared/model/product.model';
import {CatalogStore} from '../store/catalog.store';
import {productResolver} from './catalog.resolvers';

function setup(repository: Partial<ProductRepository>): InstanceType<typeof CatalogStore> {
  TestBed.configureTestingModule({providers: [CatalogStore, {provide: ProductRepository, useValue: repository}]});

  return TestBed.inject(CatalogStore);
}

function resolve(id: string): Promise<Product | undefined> {
  const route = {paramMap: convertToParamMap({id})} as ActivatedRouteSnapshot;
  const result = TestBed.runInInjectionContext(() => productResolver(route, {} as RouterStateSnapshot));

  return isObservable(result) ? firstValueFrom(result as Observable<Product | undefined>) : Promise.resolve(undefined);
}

describe('productResolver', () => {
  it('uses the store first, without touching the repository', async () => {
    const getProduct = vi.fn();
    setup({getProduct}).upsertProduct(product(5));

    expect(await resolve('5')).toMatchObject({id: 5});
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('falls back to the repository and remembers the product in the store', async () => {
    const store = setup({getProduct: () => of(product(9))});

    expect(await resolve('9')).toMatchObject({id: 9});
    expect(store.entityMap()[9]?.id).toBe(9);
  });

  it('resolves to undefined for an unknown or invalid id', async () => {
    const getProduct = vi.fn(() => of(null));
    setup({getProduct});

    expect(await resolve('9')).toBeUndefined();
    expect(await resolve('abc')).toBeUndefined();
    expect(getProduct).toHaveBeenCalledTimes(1);
  });
});
