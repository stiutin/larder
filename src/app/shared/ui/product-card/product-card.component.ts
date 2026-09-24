import {CurrencyPipe, DecimalPipe, NgOptimizedImage} from '@angular/common';
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {MatAnchor, MatButton} from '@angular/material/button';
import {MatCard, MatCardActions, MatCardContent} from '@angular/material/card';
import {RouterLink} from '@angular/router';

import {Product} from '../../model/product.model';

/** One product card for every page instead of several copies of the same template. */
@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    MatAnchor,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    NgOptimizedImage,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  public readonly product = input.required<Product>();
  public readonly inCart = input(false);
  public readonly action = input<'add' | 'remove' | 'none'>('none');
  public readonly priority = input(false);
  public readonly variant = input<'list' | 'page'>('list');

  public readonly added = output<Product>();
  public readonly removed = output<number>();
}
