import {Injectable} from '@angular/core';

import {isOfflineDbSupported, openOfflineDb, OutboxEntry} from './offline-db';

/**
 * Queue of requests that could not be sent. Entries store the full request (url, method, body),
 * so anyone can replay them: the app itself or the Service Worker via Background Sync.
 */
@Injectable({providedIn: 'root'})
export class OutboxService {
  public async put(entry: OutboxEntry): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    await (await openOfflineDb()).put('outbox', entry);
  }

  public async all(): Promise<OutboxEntry[]> {
    if (!isOfflineDbSupported()) {
      return [];
    }

    try {
      return await (await openOfflineDb()).getAll('outbox');
    } catch {
      return [];
    }
  }

  /**
   * Deletes the entry only if it was not overwritten while in flight.
   * Otherwise a newer cart snapshot written during the send would be lost.
   */
  public async deleteIfUnchanged(entry: OutboxEntry): Promise<boolean> {
    const db = await openOfflineDb();
    const tx = db.transaction('outbox', 'readwrite');
    const current = await tx.store.get(entry.id);

    if (current?.createdAt !== entry.createdAt) {
      await tx.done;

      return false;
    }

    await tx.store.delete(entry.id);
    await tx.done;

    return true;
  }

  /** Records a failed attempt — again only if the entry was not replaced by a newer one in the meantime. */
  public async bumpAttemptsIfUnchanged(entry: OutboxEntry): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    const db = await openOfflineDb();
    const tx = db.transaction('outbox', 'readwrite');
    const current = await tx.store.get(entry.id);

    if (current?.createdAt === entry.createdAt) {
      await tx.store.put({...current, attempts: current.attempts + 1});
    }

    await tx.done;
  }

  public async delete(id: string): Promise<void> {
    if (!isOfflineDbSupported()) {
      return;
    }

    await (await openOfflineDb()).delete('outbox', id);
  }
}
