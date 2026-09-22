import {ApplicationConfig, mergeApplicationConfig} from '@angular/core';
import {provideServerRendering, withRoutes} from '@angular/ssr';

import {appConfig} from './app.config';
import {serverRoutes} from './app.routes.server';
import {API_URL, SITE_URL} from './core/http/api.config';

/**
 * Build-time configuration for prerendering. `API_URL` points the build at a different API (the mock API in tests);
 * `PUBLIC_URL` is the public origin including the base path, e.g. `https://stiutin.github.io/larder`,
 * used for absolute Open Graph URLs.
 */
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {provide: API_URL, useValue: process.env.API_URL ?? 'https://dummyjson.com'},
    {provide: SITE_URL, useValue: (process.env.PUBLIC_URL ?? '').replace(/\/$/, '')},
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
