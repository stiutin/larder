import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {provideStore} from '@ngrx/store';
import {provideEffects} from '@ngrx/effects';
import {AppComponent} from './app/app.component';
import {routes} from './app/app.routes';
import {productReducer} from './app/store/reducer';
import {ProductEffects} from './app/store/effects';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideStore({products: productReducer}),
    provideEffects([ProductEffects]),
    provideHttpClient(),
  ],
});
