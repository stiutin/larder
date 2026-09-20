import {createAction, props} from '@ngrx/store';
import {IProduct} from '../shared/entities/interfaces/product.interface';

export const addToCart = createAction('[Product] Add to Cart', props<{product: IProduct}>());

export const loadProducts = createAction('[Product] Load Products');

export const loadProductsSuccess = createAction('[Product] Load Products Success', props<{products: IProduct[]}>());

export const loadProductsFailure = createAction('[Product] Load Products Failure', props<{error: unknown}>());

export const removeFromCart = createAction('[Product] Remove From Cart', props<{productId: number}>());
