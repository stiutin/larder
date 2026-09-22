import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {Router} from '@angular/router';

import {NetworkStatusService} from '../../../../core/offline/network-status.service';
import {
  CatalogQuery,
  catalogQueryKey,
  CatalogSort,
  DEFAULT_CATALOG_QUERY,
  parseCatalogQuery,
  toCatalogQueryParams,
} from '../../../../shared/model/catalog-query';
import {Product} from '../../../../shared/model/product.model';
import {ProductCardComponent} from '../../../../shared/ui/product-card/product-card.component';
import {CartStore} from '../../../cart/store/cart.store';
import {CatalogStore} from '../../store/catalog.store';
import {CatalogPaginationComponent} from '../../ui/catalog-pagination.component';
import {CatalogToolbarComponent} from '../../ui/catalog-toolbar.component';

const SKELETON_CARDS = Array.from({length: 8}, (_, index) => index);
/** Cards above the fold load with priority: on desktop that is the first row of four. */
const PRIORITY_CARDS = 4;

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
  imports: [CatalogPaginationComponent, CatalogToolbarComponent, DatePipe, MatButton, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListComponent {
  /** Query parameters arrive through `withComponentInputBinding()`. The URL is the single source of truth. */
  public readonly q = input<string>();
  public readonly category = input<string>();
  public readonly sort = input<string>();
  public readonly page = input<string>();

  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly priorityCards = PRIORITY_CARDS;

  protected readonly catalog = inject(CatalogStore);
  protected readonly online = inject(NetworkStatusService).online;

  // Template-friendly aliases for the store signals.
  protected readonly products = this.catalog.pageProducts;
  protected readonly status = this.catalog.status;
  protected readonly error = this.catalog.error;
  protected readonly categories = this.catalog.categories;
  protected readonly total = this.catalog.total;
  protected readonly pageCount = this.catalog.pageCount;
  protected readonly fetchedAt = this.catalog.fetchedAt;
  protected readonly hasFilters = this.catalog.hasFilters;
  protected readonly showSkeleton = this.catalog.isInitialLoading;

  protected readonly query = computed(
    () => parseCatalogQuery({category: this.category(), page: this.page(), q: this.q(), sort: this.sort()}),
    {equal: (a, b) => catalogQueryKey(a) === catalogQueryKey(b)}
  );

  protected readonly cartIds = computed(() => new Set(this.cart.productIds()));

  private readonly router = inject(Router);
  private readonly cart = inject(CartStore);

  constructor() {
    this.catalog.loadCategories();
    // The store follows the URL: every change of `query` requests a page, cancelling the previous request.
    this.catalog.connectQuery(this.query);
  }

  protected isInCart(productId: number): boolean {
    return this.cartIds().has(productId);
  }

  protected addToCart(product: Product): void {
    this.cart.add(product);
  }

  protected retry(): void {
    this.catalog.retry();
  }

  protected onSearch(search: string): void {
    // Typing in the search box should not flood the browser history.
    this.navigate({...this.query(), category: null, page: 1, search}, true);
  }

  protected onCategory(category: string | null): void {
    this.navigate({...this.query(), category, page: 1, search: ''});
  }

  protected onSort(sort: CatalogSort): void {
    this.navigate({...this.query(), page: 1, sort});
  }

  protected onPage(page: number): void {
    this.navigate({...this.query(), page});
  }

  protected resetFilters(): void {
    this.navigate(DEFAULT_CATALOG_QUERY);
  }

  private navigate(query: CatalogQuery, replaceUrl = false): void {
    void this.router.navigate([], {queryParams: toCatalogQueryParams(query), replaceUrl});
  }
}
