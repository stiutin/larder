import {CurrencyPipe, NgOptimizedImage} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
import {RouterLink} from '@angular/router';

import {CartItem} from '../../../shared/model/cart.model';
import {lineTotal, maxQuantity} from '../data/cart.math';

@Component({
  selector: 'app-cart-line',
  templateUrl: './cart-line.component.html',
  styleUrl: './cart-line.component.scss',
  imports: [CurrencyPipe, NgOptimizedImage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartLineComponent {
  public readonly item = input.required<CartItem>();
  /** The first line's thumbnail can be the largest element on the cart page, i.e. its LCP. */
  public readonly priority = input(false);

  public readonly increment = output<number>();
  public readonly decrement = output<number>();
  public readonly remove = output<number>();

  protected readonly total = computed(() => lineTotal(this.item()));
  protected readonly atMax = computed(() => this.item().quantity >= maxQuantity(this.item()));
}
