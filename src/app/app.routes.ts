import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: 'cart',
    title: 'Cart',
    loadComponent: () => import('./features/cart/pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'about',
    title: 'About us',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'contact',
    title: 'Contact us',
    loadComponent: () => import('./features/contact/pages/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: '',
    loadChildren: () => import('./features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./shared/ui/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
