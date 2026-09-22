import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {render, screen} from '@testing-library/angular';
import {of} from 'rxjs';

import {product, resetOfflineDb} from '../../../../../testing/fixtures';
import {API_URL} from '../../../../core/http/api.config';
import {OutboxSyncService} from '../../../../core/offline/outbox-sync.service';
import {ProductRepository} from '../../../../shared/data/product-repository';
import {CartStore} from '../../store/cart.store';
import {CartComponent} from './cart.component';

async function setup(fresh: (id: number) => ReturnType<ProductRepository['getFreshProduct']>): Promise<void> {
  await render(CartComponent, {
    providers: [
      provideRouter([]),
      {provide: API_URL, useValue: 'https://api.test'},
      {provide: ProductRepository, useValue: {getFreshProduct: fresh}},
      {provide: OutboxSyncService, useValue: {enqueue: vi.fn(), lastSyncedAt: () => null, status: () => 'idle'}},
    ],
  });
}

describe('CartComponent', () => {
  beforeEach(resetOfflineDb);

  it('shows an empty state with a way back to the catalogue', async () => {
    await setup(() => of(undefined));

    expect(await screen.findByText(/Your cart is empty|Cart is empty/)).toBeTruthy();
  });

  it('lists items with totals and surfaces a price change for the user to decide', async () => {
    await setup((id) => of(product(id, {price: id === 1 ? 14 : 5})));
    const cart = TestBed.inject(CartStore);
    await screen.findByRole('heading', {level: 1});

    cart.add(product(1, {discountPercentage: 0, price: 10}));
    cart.add(product(2, {discountPercentage: 0, price: 5}));
    cart.reconcile();

    expect(await screen.findByText('Product 1')).toBeTruthy();
    expect(await screen.findAllByText('$15.00', {selector: 'dd'})).toHaveLength(2); // subtotal and total, no discount
    expect(await screen.findByRole('button', {name: /Accept/})).toBeTruthy();
  });
});
