import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';

import {OutboxSyncService} from '../../../../core/offline/outbox-sync.service';
import {CartStore} from '../../store/cart.store';

/**
 * Cart counter in the header. Loaded via `@defer (on idle)`:
 * CartStore and the whole data layer (IndexedDB, valibot, queue) go into the lazy chunk with it.
 * The server has no cart — it lives on the device — so SSR renders the placeholder anyway.
 */
@Component({
  selector: 'app-cart-badge',
  templateUrl: './cart-badge.component.html',
  styleUrl: './cart-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartBadgeComponent {
  protected readonly cart = inject(CartStore);
  protected readonly sync = inject(OutboxSyncService);
  protected readonly pending = computed(() => ['error', 'pending'].includes(this.sync.status()));
}
