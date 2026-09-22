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

/**
 * A 4xx other than timeouts and rate limits: the request itself is wrong and sending it again will not help.
 * Accepts both the domain `ApiError` (after the interceptor) and a raw `HttpErrorResponse`.
 */
function isPermanentFailure(error: unknown): boolean {
  const status = error instanceof ApiError || error instanceof HttpErrorResponse ? error.status : null;

  return (
    status !== null &&
    status >= HTTP_CLIENT_ERROR_MIN &&
    status < HTTP_SERVER_ERROR_MIN &&
    !RETRYABLE_CLIENT_STATUSES.has(status)
  );
}

/**
 * Delivers everything that was queued while offline — cart snapshots, contact messages, anything else.
 *
 * Delivery: immediately when online; otherwise Background Sync in the Service Worker,
 * and where that is missing (Safari, Firefox) a manual retry on the `online` event and on startup.
 * Entries with the same id overwrite each other, so a queue of cart snapshots never grows.
 */
@Injectable({providedIn: 'root'})
export class OutboxSyncService {
  public readonly status = signal<OutboxSyncStatus>('idle');
  public readonly lastSyncedAt = signal<number | null>(null);

  private readonly http = inject(HttpClient);
  private readonly outbox = inject(OutboxService);
  private readonly network = inject(NetworkStatusService);

  /** The running flush, if any. Flushes are serialised: every caller's flush starts after its own enqueue. */
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

        // The Service Worker flushed the queue in the background while the tab was closed or asleep.
        if (data?.type === 'outbox-flushed') {
          this.status.set('synced');
          this.lastSyncedAt.set(data.at ?? Date.now());
        }
      });
    }
  }

  /** Queues a request and tries to deliver it straight away. */
  /** Stores the request durably and tries to deliver it right away. */
  public async enqueue(request: OutboxRequest): Promise<void> {
    await this.stage(request);
    await this.deliver();
  }

  /**
   * Stores the request durably without sending it. An entry with the same id replaces the previous one.
   * Callers that batch changes (the cart) stage every change immediately and call `deliver()` later, debounced:
   * a closed tab or a reload in between loses nothing — the entry is delivered on the next start.
   */
  /** Removes a staged request that no longer needs to be sent. */
  public async unstage(id: string): Promise<void> {
    await this.outbox.delete(id);
    this.status.set(this.lastSyncedAt() ? 'synced' : 'idle');
  }

  public async stage(request: OutboxRequest): Promise<void> {
    await this.outbox.put({...request, attempts: 0, createdAt: Date.now()});
    this.status.set('pending');
  }

  /** Sends whatever is queued: now if online, otherwise via Background Sync (or the next `online` event). */
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
            // The server understood the request and refused it (400, 404, 422…). Retrying cannot help and would
            // keep the queue stuck forever, so the entry is dropped and the status says so.
            console.warn('[outbox] request rejected, dropped:', entry.url, error);
            await this.outbox.deleteIfUnchanged(entry);
            rejected = true;
            continue;
          }

          // Not `put`: a newer snapshot may have been queued while this one was in flight.
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
      // No SW or no permission — the manual retry on `online` remains.
    }
  }
}
