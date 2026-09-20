import {Component, OnInit, inject, ChangeDetectionStrategy} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {Title} from '@angular/platform-browser';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {Store} from '@ngrx/store';
import {map, Observable} from 'rxjs';
import * as ProductActions from '../../store/actions';
import * as ProductSelectors from '../../store/selectors';
import {IProduct} from '../../shared/entities/interfaces/product.interface';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
  imports: [AsyncPipe, MatCardModule, MatButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ProductsComponent implements OnInit {
  private store = inject(Store);
  protected products$: Observable<IProduct[]> = this.store.select(ProductSelectors.selectProducts);
  protected productsInCart$: Observable<IProduct[]> = this.store.select(ProductSelectors.selectFavoriteProducts);
  private titleService = inject(Title);

  constructor() {
    this.titleService.setTitle('Esto App | Home');
  }

  public ngOnInit(): void {
    this.store.dispatch(ProductActions.loadProducts());
  }

  protected favoriteIds$ = this.productsInCart$.pipe(map((favs) => favs.map((f) => f.id)));

  protected isInCart(productId: number, favoriteIds: number[]): boolean {
    return favoriteIds.includes(productId);
  }

  protected addToCart(product: IProduct, event: MouseEvent): void {
    this.store.dispatch(ProductActions.addToCart({product}));
    (event.target as HTMLButtonElement).disabled = true;
  }
}
