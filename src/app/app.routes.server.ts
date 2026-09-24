import {inject} from '@angular/core';
import {PrerenderFallback, RenderMode, ServerRoute} from '@angular/ssr';

import {API_URL} from './core/http/api.config';

export const serverRoutes: ServerRoute[] = [
  {path: '', renderMode: RenderMode.Prerender},
  {path: 'about', renderMode: RenderMode.Prerender},
  {path: 'contact', renderMode: RenderMode.Prerender},
  {path: 'cart', renderMode: RenderMode.Prerender},
  {
    fallback: PrerenderFallback.Client,
    async getPrerenderParams(): Promise<{id: string}[]> {
      const response = await fetch(`${inject(API_URL)}/products?limit=0&select=id`);
      const {products} = (await response.json()) as {products: {id: number}[]};

      return products.map(({id}) => ({id: String(id)}));
    },
    path: 'product/:id',
    renderMode: RenderMode.Prerender,
  },
  {path: '**', renderMode: RenderMode.Client},
];
