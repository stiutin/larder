import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {catchError, throwError} from 'rxjs';

import {ApiError} from '../error/api.error';

const HTTP_SERVER_ERROR = 500;
const NETWORK_FAILURE = 0;

/** Maps transport errors to domain errors once, instead of in every effect. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === NETWORK_FAILURE) {
        return throwError(() => new ApiError('offline', 'No connection to the server', null));
      }

      const kind = error.status >= HTTP_SERVER_ERROR ? 'server' : 'client';

      return throwError(() => new ApiError(kind, error.message, error.status));
    })
  );
