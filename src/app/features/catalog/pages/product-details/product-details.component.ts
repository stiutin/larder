import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {MatAnchor} from '@angular/material/button';
import {RouterLink} from '@angular/router';

import {NetworkStatusService} from '../../../../core/offline/network-status.service';
import {Product} from '../../../../shared/model/product.model';
import {ProductCardComponent} from '../../../../shared/ui/product-card/product-card.component';
import {CartStore} from '../../../cart/store/cart.store';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss',
  imports: [MatAnchor, ProductCardComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsComponent {
  /** Comes from the resolver via `withComponentInputBinding()`, not from `route.snapshot`. */
  public readonly product = input<Product | undefined>();

  protected readonly online = inject(NetworkStatusService).online;
  protected readonly inCart = computed(() => {
    const product = this.product();

    return product ? this.cart.productIds().includes(product.id) : false;
  });

  private readonly cart = inject(CartStore);

  protected addToCart(product: Product): void {
    this.cart.add(product);
  }
}
