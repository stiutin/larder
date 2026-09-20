import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {ProductDataService} from '../shared/services/product-data.service';
import * as ProductActions from './actions';
import {catchError, map, mergeMap, of} from 'rxjs';

@Injectable()
export class ProductEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly productService: ProductDataService
  ) {}

  loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ProductActions.loadProducts),
      mergeMap(() =>
        this.productService.getProducts().pipe(
          map((response) =>
            ProductActions.loadProductsSuccess({
              products: response.products,
            })
          ),
          catchError((error) => of(ProductActions.loadProductsFailure({error})))
        )
      )
    )
  );
}
