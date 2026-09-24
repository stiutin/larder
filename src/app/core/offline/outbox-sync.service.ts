import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {effect, inject, Injectable, signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {ApiError} from '../error/api.error';
import {NetworkStatusService} from './network-status.service';
import {OutboxEntry} from './offline-db';
import {OutboxService} from './outbox.service';

export type OutboxSyncStatus = 'error' | 'idle' | 'pending' | 'rejected' | 'synced' | 'syncing';

/** Must match the tag handled in `src/sw-sync.js`. */
export const OUTBOX_SYNC_TAG = 'outbox-sync';
const MAX_FLUSH_ROUNDS = 5;

export type OutboxRequest = Pick<OutboxEntry, 'body' | 'id' | 'method' | 'url'>;

interface SyncCapableRegistration extends ServiceWorkerRegistration {
  sync: {register: (tag: string) => Promise<void>};
}

function supportsBackgroundSync(registration: ServiceWorkerRegistration): registration is SyncCapableRegistration {
  return 'sync' in registration;
}

const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_EARLY = 425;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const RETRYABLE_CLIENT_STATUSES = new Set([HTTP_REQUEST_TIMEOUT, HTTP_TOO_EARLY, HTTP_TOO_MANY_REQUESTS]);

function isPermanentFailure(error: unknown): boolean {
  const status = error instanceof ApiError || error instanceof HttpErrorResponse ? error.status : null;

  return (
    status !== null &&
    status >= HTTP_CLIENT_ERROR_MIN &&
    status < HTTP_SERVER_ERROR_MIN &&
    !RETRYABLE_CLIENT_STATUSES.has(status)
  );
}

@Injectable({providedIn: 'root'})
export class OutboxSyncService {
  public readonly status = signal<OutboxSyncStatus>('idle');
  public readonly lastSyncedAt = signal<number | null>(null);

  private readonly http = inject(HttpClient);
  private readonly outbox = inject(OutboxService);
  private readonly network = inject(NetworkStatusService);

  private currentFlush: Promise<void> | null = null;

  constructor() {
    effect(() => {
      if (this.network.online()) {
        void this.flush();
      }
    });

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent<unknown>) => {
        const data = event.data as {at?: number; type?: string} | null;

        if (data?.type === 'outbox-flushed') {
          this.status.set('synced');
          this.lastSyncedAt.set(data.at ?? Date.now());
        }
      });
    }
  }

  public async enqueue(request: OutboxRequest): Promise<void> {
    await this.stage(request);
    await this.deliver();
  }

  public async unstage(id: string): Promise<void> {
    await this.outbox.delete(id);
    this.status.set(this.lastSyncedAt() ? 'synced' : 'idle');
  }

  public async stage(request: OutboxRequest): Promise<void> {
    await this.outbox.put({...request, attempts: 0, createdAt: Date.now()});
    this.status.set('pending');
  }

  public async deliver(): Promise<void> {
    if (this.network.online()) {
      await this.flush();
    } else {
      await this.requestBackgroundSync();
    }
  }

  public async flush(): Promise<void> {
    while (this.currentFlush) {
      await this.currentFlush;
    }

    this.currentFlush = this.runFlush();

    try {
      await this.currentFlush;
    } finally {
      this.currentFlush = null;
    }
  }

  private async runFlush(): Promise<void> {
    let rejected = false;

    for (let round = 0; round < MAX_FLUSH_ROUNDS; round++) {
      const entries = await this.outbox.all();

      if (!entries.length) {
        break;
      }

      this.status.set('syncing');

      for (const entry of entries) {
        try {
          await firstValueFrom(this.http.request(entry.method, entry.url, {body: entry.body}));
          await this.outbox.deleteIfUnchanged(entry);
          this.lastSyncedAt.set(Date.now());
        } catch (error: unknown) {
          if (isPermanentFailure(error)) {
            console.warn('[outbox] request rejected, dropped:', entry.url, error);
            await this.outbox.deleteIfUnchanged(entry);
            rejected = true;
            continue;
          }

          await this.outbox.bumpAttemptsIfUnchanged(entry);
          this.status.set('error');
          await this.requestBackgroundSync();

          return;
        }
      }
    }

    const remaining = (await this.outbox.all()).length;
    this.status.set(remaining ? 'pending' : rejected ? 'rejected' : this.lastSyncedAt() ? 'synced' : 'idle');
  }

  private async requestBackgroundSync(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration && supportsBackgroundSync(registration)) {
        await registration.sync.register(OUTBOX_SYNC_TAG);
      }
    } catch {
      // No SW or no permission - the manual retry on `online` remains.
    }
  }
}
