import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {signal, WritableSignal} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import {resetOfflineDb} from '../../../testing/fixtures';
import {NetworkStatusService} from './network-status.service';
import {OutboxService} from './outbox.service';
import {OutboxRequest, OutboxSyncService} from './outbox-sync.service';

const URL = 'https://api.test/carts/add';
const request = (v: number): OutboxRequest => ({body: {v}, id: 'cart-sync', method: 'POST', url: URL});

interface Setup {
  http: HttpTestingController;
  network: {online: WritableSignal<boolean>};
  sync: OutboxSyncService;
}

function setup(online: boolean): Setup {
  const network = {online: signal(online)};
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), {provide: NetworkStatusService, useValue: network}],
  });

  return {http: TestBed.inject(HttpTestingController), network, sync: TestBed.inject(OutboxSyncService)};
}

const nextRequest = (http: HttpTestingController): Promise<ReturnType<HttpTestingController['expectOne']>> =>
  vi.waitFor(() => http.expectOne(URL));

describe('OutboxSyncService', () => {
  beforeEach(resetOfflineDb);

  it('online: sends immediately and empties the queue', async () => {
    const {http, sync} = setup(true);

    const done = sync.enqueue(request(1));
    (await nextRequest(http)).flush({});
    await done;

    expect(sync.status()).toBe('synced');
    expect(await TestBed.inject(OutboxService).all()).toEqual([]);
  });

  it('offline: keeps the request and delivers it when the connection returns', async () => {
    const {http, network, sync} = setup(false);

    await sync.enqueue(request(1));
    expect(sync.status()).toBe('pending');
    http.expectNone(URL);

    network.online.set(true);
    TestBed.tick();
    (await nextRequest(http)).flush({});

    await vi.waitFor(() => expect(sync.status()).toBe('synced'));
  });

  it('stage() stores without sending; deliver() sends the latest staged snapshot', async () => {
    const {http, network, sync} = setup(false);

    await sync.stage(request(1));
    await sync.stage(request(2));
    http.expectNone(URL);
    expect(sync.status()).toBe('pending');

    network.online.set(true);
    const done = sync.deliver();
    const sent = await nextRequest(http);
    expect(sent.request.body).toEqual({v: 2});
    sent.flush({});
    await done;

    expect(await TestBed.inject(OutboxService).all()).toEqual([]);
  });

  it('a failed request stays queued and counts the attempt', async () => {
    const {http, network, sync} = setup(false);
    await sync.enqueue(request(1));

    network.online.set(true);
    TestBed.tick();
    (await nextRequest(http)).flush('down', {status: 503, statusText: 'Service Unavailable'});

    await vi.waitFor(() => expect(sync.status()).toBe('error'));
    expect((await TestBed.inject(OutboxService).all())[0]?.attempts).toBe(1);
  });

  it('a request the server rejects (400) is dropped instead of retried forever', async () => {
    const {http, network, sync} = setup(false);
    await sync.enqueue(request(1));

    network.online.set(true);
    TestBed.tick();
    (await nextRequest(http)).flush({message: 'bad request'}, {status: 400, statusText: 'Bad Request'});

    await vi.waitFor(() => expect(sync.status()).toBe('rejected'));
    expect(await TestBed.inject(OutboxService).all()).toEqual([]);
  });

  it('rate limiting (429) is temporary: the request stays queued', async () => {
    const {http, network, sync} = setup(false);
    await sync.enqueue(request(1));

    network.online.set(true);
    TestBed.tick();
    (await nextRequest(http)).flush('slow down', {status: 429, statusText: 'Too Many Requests'});

    await vi.waitFor(() => expect(sync.status()).toBe('error'));
    expect(await TestBed.inject(OutboxService).all()).toHaveLength(1);
  });

  it('unstage() removes a pending request', async () => {
    const {http, sync} = setup(false);
    await sync.stage(request(1));

    await sync.unstage('cart-sync');

    expect(await TestBed.inject(OutboxService).all()).toEqual([]);
    expect(sync.status()).toBe('idle');
    http.expectNone(URL);
  });
});
