import {ErrorHandler, Injectable} from '@angular/core';

import {ApiError} from './api.error';

/**
 * The single place unhandled errors end up in.
 * The place to plug in an external reporting service (Sentry, OpenTelemetry) later.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  public handleError(error: unknown): void {
    if (error instanceof ApiError) {
      console.error(`[api:${error.kind}]`, error.message);

      return;
    }

    console.error(error);
  }
}
