import {provideHttpClient, withFetch, withInterceptors} from '@angular/common/http';
import {ApplicationConfig, ErrorHandler, isDevMode, provideZonelessChangeDetection} from '@angular/core';
import {provideClientHydration, withEventReplay} from '@angular/platform-browser';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import {provideServiceWorker} from '@angular/service-worker';

import {routes} from './app.routes';
import {GlobalErrorHandler} from './core/error/global-error.handler';
import {API_URL} from './core/http/api.config';
import {apiErrorInterceptor} from './core/http/api-error.interceptor';
import {AppTitleStrategy} from './core/routing/app-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      // Next catalog page scrolls to the top; Back restores the previous position.
      withInMemoryScrolling({scrollPositionRestoration: 'enabled'})
    ),
    provideHttpClient(withFetch(), withInterceptors([apiErrorInterceptor])),
    {provide: API_URL, useValue: 'https://dummyjson.com'},
    {provide: ErrorHandler, useClass: GlobalErrorHandler},
    {provide: TitleStrategy, useClass: AppTitleStrategy},
    // `sw-sync.js` imports the standard ngsw-worker and adds a Background Sync handler.
    provideServiceWorker('sw-sync.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Hydration instead of re-rendering; clicks and typing before the JS loads are replayed afterwards.
    // The client does not re-request server GETs — the HTTP transfer cache is on by default.
    provideClientHydration(withEventReplay()),
  ],
};
