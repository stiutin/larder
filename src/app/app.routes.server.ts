import {inject} from '@angular/core';
import {PrerenderFallback, RenderMode, ServerRoute} from '@angular/ssr';

import {API_URL} from './core/http/api.config';

/**
 * Everything is prerendered at build time: the site is deployed to GitHub Pages, which only serves files.
 *
 * - `''`, `about`, `contact`, `cart` — one HTML file each. Query variants of the catalogue (`?page=2`) get the
 *   same file; the client store follows the URL and loads the right page after hydration.
 * - `product/:id` — one file per product, ids fetched from the API during the build.
 * - `**` — client-rendered: GitHub Pages serves `404.html` (the client shell) for unknown paths,
 *   and the router shows the not-found page or any product added after the last build.
 */
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
