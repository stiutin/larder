import {createFeatureSelector, createSelector} from '@ngrx/store';
import {ProductState} from './reducer';
import {IProduct} from '../shared/entities/interfaces/product.interface';

export const selectProductState = createFeatureSelector<ProductState>('products');

export const selectProducts = createSelector(selectProductState, (state) => state.products);

export const selectFavoriteProducts = createSelector(selectProductState, (state) => state.productsInCart);

export const selectProductById = (productId: number) =>
  createSelector(selectProductState, (state): IProduct | undefined =>
    state.products.find((p: IProduct) => p.id === productId)
  );
