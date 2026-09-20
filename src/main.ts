import {provideZoneChangeDetection} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {provideHttpClient} from '@angular/common/http';
import {provideStore} from '@ngrx/store';
import {provideEffects} from '@ngrx/effects';
import {AppComponent} from './app/app.component';
import {routes} from './app/app.routes';
import {photoReducer} from './app/store/reducer';
import {PhotoEffects} from './app/store/effects';

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes),
    provideStore({photos: photoReducer}),
    provideEffects([PhotoEffects]),
    provideHttpClient(),
  ],
});
