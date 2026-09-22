import {InjectionToken} from '@angular/core';

export const API_URL = new InjectionToken<string>('API_URL');

export const API_ENDPOINTS = {
  cartsAdd: 'carts/add',
  categories: 'products/categories',
  // dummyjson has no contact endpoint; `posts/add` accepts a JSON body and echoes it back. Mock, not storage.
  contact: 'posts/add',
  product: (id: number): string => `products/${id}`,
} as const;

/**
 * Public origin of the site, e.g. `https://larder.example`. Set on the server from `PUBLIC_URL` so that
 * Open Graph images and `og:url` are absolute — link previews ignore relative URLs.
 */
export const SITE_URL = new InjectionToken<string>('SITE_URL');
