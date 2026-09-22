import {TestBed} from '@angular/core/testing';

import {resetOfflineDb} from '../../../testing/fixtures';
import {OutboxEntry} from './offline-db';
import {OutboxService} from './outbox.service';

const entry = (createdAt: number, body: unknown = {v: createdAt}): OutboxEntry => ({
  attempts: 0,
  body,
  createdAt,
  id: 'cart-sync',
  method: 'POST',
  url: 'https://api.test/carts/add',
});

describe('OutboxService', () => {
  beforeEach(resetOfflineDb);

  it('an entry replaced while in flight is neither deleted nor overwritten', async () => {
    const outbox = TestBed.inject(OutboxService);
    const inFlight = entry(1);

    await outbox.put(inFlight);
    await outbox.put(entry(2)); // the user changed the cart while v1 was being sent

    expect(await outbox.deleteIfUnchanged(inFlight)).toBe(false);
    await outbox.bumpAttemptsIfUnchanged(inFlight);

    const [current] = await outbox.all();
    expect(current).toMatchObject({attempts: 0, body: {v: 2}, createdAt: 2});
  });

  it('deletes and counts attempts for the entry it actually sent', async () => {
    const outbox = TestBed.inject(OutboxService);

    await outbox.put(entry(1));
    await outbox.bumpAttemptsIfUnchanged(entry(1));
    expect((await outbox.all())[0]?.attempts).toBe(1);

    expect(await outbox.deleteIfUnchanged(entry(1))).toBe(true);
    expect(await outbox.all()).toEqual([]);
  });
});
