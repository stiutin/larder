import {createReducer, on} from '@ngrx/store';
import * as ProductActions from './actions';
import {IProduct} from '../shared/entities/interfaces/product.interface';

export interface ProductState {
  products: IProduct[];
  productsInCart: IProduct[];
  error: unknown;
}

export const initialState: ProductState = {
  products: [],
  productsInCart: [],
  error: null,
};

export const productReducer = createReducer(
  initialState,
  on(ProductActions.loadProductsSuccess, (state, {products}) => ({
    ...state,
    products,
  })),
  on(ProductActions.loadProductsFailure, (state, {error}) => ({
    ...state,
    error,
  })),
  on(ProductActions.addToCart, (state, {product}) => ({
    ...state,
    productsInCart: [...state.productsInCart, product],
  })),
  on(ProductActions.removeFromCart, (state, {productId}) => ({
    ...state,
    productsInCart: state.productsInCart.filter((p) => p.id !== productId),
  }))
);
