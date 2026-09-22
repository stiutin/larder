import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';

import {ApiError} from '../error/api.error';
import {apiErrorInterceptor} from './api-error.interceptor';

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  const failWith = async (respond: (url: string) => void): Promise<ApiError> => {
    const request = firstValueFrom(http.get('/x'));
    respond('/x');

    return request.then(
      () => {
        throw new Error('expected a failure');
      },
      (error: unknown) => error as ApiError
    );
  };

  it.each([
    [503, 'server', true],
    [404, 'client', false],
  ] as const)('HTTP %i → ApiError(%s), retryable: %s', async (status, kind, retryable) => {
    const error = await failWith((url) => controller.expectOne(url).flush('', {status, statusText: 'x'}));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
    expect(error.isRetryable).toBe(retryable);
  });

  it('a network failure becomes "offline"', async () => {
    const error = await failWith((url) => controller.expectOne(url).error(new ProgressEvent('error')));

    expect(error.kind).toBe('offline');
    expect(error.isRetryable).toBe(true);
  });
});
