import {Routes} from '@angular/router';

import {productResolver} from './routing/catalog.resolvers';
import {CatalogStore} from './store/catalog.store';

/**
 * The catalogue is lazy together with its store, resolver and data layer.
 * `CatalogStore` is provided here, so every page under this route shares one instance.
 */
export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    providers: [CatalogStore],
    children: [
      {
        path: '',
        title: 'Catalogue',
        loadComponent: () => import('./pages/product-list/product-list.component').then((m) => m.ProductListComponent),
      },
      {
        path: 'product/:id',
        title: 'Product',
        resolve: {product: productResolver},
        loadComponent: () =>
          import('./pages/product-details/product-details.component').then((m) => m.ProductDetailsComponent),
      },
    ],
  },
];
