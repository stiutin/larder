import {InjectionToken} from '@angular/core';

export const API_URL = new InjectionToken<string>('API_URL');

export const API_ENDPOINTS = {
  cartsAdd: 'carts/add',
  categories: 'products/categories',
  // dummyjson has no contact endpoint; `posts/add` accepts a JSON body and echoes it back. Mock, not storage.
  contact: 'posts/add',
  product: (id: number): string => `products/${id}`,
} as const;

export const SITE_URL = new InjectionToken<string>('SITE_URL');
