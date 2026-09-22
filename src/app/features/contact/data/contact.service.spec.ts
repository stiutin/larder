import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import {API_URL} from '../../../core/http/api.config';
import {NetworkStatusService} from '../../../core/offline/network-status.service';
import {OutboxRequest, OutboxSyncService} from '../../../core/offline/outbox-sync.service';
import {ContactMessage, ContactService, toContactRequestBody} from './contact.service';

const message: ContactMessage = {
  email: 'ada@example.com',
  message: 'Hello there, this is a test message.',
  name: ' Ada ',
  topic: 'feedback',
};

function setup(online: boolean): {http: HttpTestingController; queued: OutboxRequest[]; service: ContactService} {
  const queued: OutboxRequest[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: API_URL, useValue: 'https://api.test'},
      {provide: NetworkStatusService, useValue: {online: signal(online)}},
      {provide: OutboxSyncService, useValue: {enqueue: async (request: OutboxRequest) => void queued.push(request)}},
    ],
  });

  return {http: TestBed.inject(HttpTestingController), queued, service: TestBed.inject(ContactService)};
}

describe('ContactService', () => {
  it('maps the form to the request body and trims input', () => {
    expect(toContactRequestBody(message)).toEqual({
      body: 'Hello there, this is a test message.',
      title: '[feedback] Ada <ada@example.com>',
      userId: 1,
    });
  });

  it('online: sends right away', async () => {
    const {http, queued, service} = setup(true);

    const result = service.send(message);
    http.expectOne({method: 'POST', url: 'https://api.test/posts/add'}).flush({});

    expect(await result).toBe('sent');
    expect(queued).toEqual([]);
  });

  it('offline: queues without touching the network', async () => {
    const {http, queued, service} = setup(false);

    expect(await service.send(message)).toBe('queued');
    http.expectNone('https://api.test/posts/add');
    expect(queued[0]).toMatchObject({method: 'POST', url: 'https://api.test/posts/add'});
  });

  it('a failed request is queued instead of lost', async () => {
    const {http, queued, service} = setup(true);

    const result = service.send(message);
    const pending = await vi.waitFor(() => http.expectOne('https://api.test/posts/add'));
    pending.flush('', {status: 500, statusText: 'x'});

    expect(await result).toBe('queued');
    expect(queued).toHaveLength(1);
  });
});
