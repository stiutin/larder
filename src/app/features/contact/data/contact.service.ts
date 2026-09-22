import {HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {API_ENDPOINTS, API_URL} from '../../../core/http/api.config';
import {NetworkStatusService} from '../../../core/offline/network-status.service';
import {OutboxSyncService} from '../../../core/offline/outbox-sync.service';

export const CONTACT_TOPICS = ['general', 'feedback', 'bug', 'partnership'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export interface ContactMessage {
  email: string;
  message: string;
  name: string;
  topic: ContactTopic;
}

export type ContactResult = 'queued' | 'sent';

/** Maps the form to the body of the mock endpoint. The future Nest.js API will take `ContactMessage` as is. */
export function toContactRequestBody(message: ContactMessage): {body: string; title: string; userId: number} {
  return {
    body: message.message.trim(),
    title: `[${message.topic}] ${message.name.trim()} <${message.email.trim()}>`,
    userId: 1,
  };
}

/**
 * Online: send right away and report "sent".
 * Offline or the request failed: put the message into the same outbox the cart uses and report "queued" —
 * it is delivered automatically when the connection returns, even if the tab is closed (Background Sync).
 */
@Injectable({providedIn: 'root'})
export class ContactService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly network = inject(NetworkStatusService);
  private readonly outbox = inject(OutboxSyncService);

  public async send(message: ContactMessage): Promise<ContactResult> {
    const url = `${this.apiUrl}/${API_ENDPOINTS.contact}`;
    const body = toContactRequestBody(message);

    if (this.network.online()) {
      try {
        await firstValueFrom(this.http.post(url, body));

        return 'sent';
      } catch {
        // Fall through to the queue: a flaky network should not lose the message.
      }
    }

    await this.outbox.enqueue({body, id: `contact-${Date.now()}`, method: 'POST', url});

    return 'queued';
  }
}
