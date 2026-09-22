export type ApiErrorKind = 'client' | 'offline' | 'parse' | 'server';

/**
 * Domain error. Components should not know about HttpErrorResponse
 * or inspect status codes — `kind` is all they need.
 */
export class ApiError extends Error {
  public readonly kind: ApiErrorKind;
  public readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }

  public get isRetryable(): boolean {
    return this.kind === 'offline' || this.kind === 'server';
  }
}
