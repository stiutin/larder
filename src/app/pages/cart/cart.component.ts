import {Component, inject, ChangeDetectionStrategy} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {Store} from '@ngrx/store';
import {Observable} from 'rxjs';
import * as ProductSelectors from '../../store/selectors';
import {RouterLink} from '@angular/router';
import {AsyncPipe} from '@angular/common';
import {IProduct} from '../../shared/entities/interfaces/product.interface';
import {MatButton} from '@angular/material/button';
import {
  MatCard,
  MatCardActions,
  MatCardContent,
  MatCardHeader,
  MatCardImage,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import * as ProductActions from '../../store/actions';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  imports: [
    RouterLink,
    AsyncPipe,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatCardHeader,
    MatCardImage,
    MatCardSubtitle,
    MatCardTitle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class CartComponent {
  private readonly store = inject(Store);
  private readonly titleService = inject(Title);
  protected productsInCart$: Observable<IProduct[]> = this.store.select(ProductSelectors.selectFavoriteProducts);

  constructor() {
    this.titleService.setTitle('Esto App | Cart');
  }

  protected removeProduct(productId: number): void {
    this.store.dispatch(ProductActions.removeFromCart({productId}));
  }
}
