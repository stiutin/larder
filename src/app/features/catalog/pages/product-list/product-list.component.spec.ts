import {provideRouter} from '@angular/router';
import {render, screen} from '@testing-library/angular';
import {of} from 'rxjs';

import {product} from '../../../../../testing/fixtures';
import {API_URL} from '../../../../core/http/api.config';
import {OutboxSyncService} from '../../../../core/offline/outbox-sync.service';
import {CatalogPageEvent, ProductRepository} from '../../../../shared/data/product-repository';
import {CatalogStore} from '../../store/catalog.store';
import {ProductListComponent} from './product-list.component';

async function setup(total: number, inputs: Record<string, string> = {}): Promise<void> {
  const ids = Array.from({length: Math.min(total, 20)}, (_, index) => index + 1);
  const event: CatalogPageEvent = {
    fetchedAt: 1,
    page: {products: ids.map((id) => product(id)), total},
    source: 'network',
    type: 'data',
  };

  await render(ProductListComponent, {
    inputs,
    providers: [
      provideRouter([]),
      CatalogStore,
      {provide: API_URL, useValue: 'https://api.test'},
      {provide: OutboxSyncService, useValue: {enqueue: vi.fn()}},
      {provide: ProductRepository, useValue: {getCategories: () => of([]), getPage: () => of(event)}},
    ],
  });
}

describe('ProductListComponent', () => {
  it('renders the page of products with paging and the result count', async () => {
    await setup(45);

    expect(await screen.findAllByRole('heading', {level: 2})).toHaveLength(20);
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByText(/45/)).toBeTruthy();
  });

  it('explains an empty search and offers a way back', async () => {
    await setup(0, {q: 'unicorn'});

    expect(await screen.findByText(/Nothing found for “unicorn”|Nothing found for "unicorn"/)).toBeTruthy();
    expect(screen.getByRole('button', {name: /Clear search/})).toBeTruthy();
  });
});
