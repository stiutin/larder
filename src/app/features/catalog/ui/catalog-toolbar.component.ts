import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {debounceTime, distinctUntilChanged, map} from 'rxjs';

import {CATALOG_SORTS, CatalogQuery, CatalogSort} from '../../../shared/model/catalog-query';
import {Category} from '../../../shared/model/product.model';

const SEARCH_DEBOUNCE_MS = 300;

export const SORT_LABELS: Record<CatalogSort, string> = {
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Top rated',
  relevance: 'Featured',
};

/** Pushes an externally changed value (Back, "clear filters") into an uncontrolled form field. */
function syncFieldValue(field: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (field.value.trim() !== value) {
    // eslint-disable-next-line no-param-reassign -- updating the DOM field is the purpose of this helper
    field.value = value;
  }
}

@Component({
  selector: 'app-catalog-toolbar',
  templateUrl: './catalog-toolbar.component.html',
  styleUrl: './catalog-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogToolbarComponent {
  public readonly query = input.required<CatalogQuery>();
  public readonly categories = input<Category[]>([]);

  public readonly searchChange = output<string>();
  public readonly categoryChange = output<string | null>();
  public readonly sortChange = output<CatalogSort>();

  /**
   * The search field is a `linkedSignal`: the user types freely, but when the URL changes externally
   * (Back button, reset filters) the value re-syncs on its own.
   */
  protected readonly searchTerm = linkedSignal(() => this.query().search);
  protected readonly sorts = CATALOG_SORTS;
  protected readonly sortLabels = SORT_LABELS;

  private readonly searchField = viewChild.required<ElementRef<HTMLInputElement>>('searchField');
  private readonly categoryField = viewChild.required<ElementRef<HTMLSelectElement>>('categoryField');
  private readonly sortField = viewChild.required<ElementRef<HTMLSelectElement>>('sortField');

  constructor() {
    /*
     * The fields are uncontrolled on purpose: values are rendered as attributes (`[attr.value]`,
     * `[attr.selected]`). A property binding would be re-applied during hydration and wipe whatever the user
     * typed before the JavaScript arrived — and the replayed input event would then read an empty field.
     * External URL changes (Back, "clear filters") are pushed into the fields here, skipping the first run.
     */
    /*
     * After hydration, adopt whatever the fields already hold. Normally replayed events deliver early typing,
     * but not every early change produces one — browser autofill, form restoration, or input that raced the
     * hand-over from the pre-hydration event contract. The fields keep their values (attribute bindings), so read them.
     */
    afterNextRender(() => {
      const query = this.query();
      const typed = this.searchField().nativeElement.value;

      if (typed.trim() !== query.search) {
        this.searchTerm.set(typed);
      }

      const sort = this.sortField().nativeElement.value;

      if (sort && sort !== query.sort) {
        this.sortChange.emit(sort as CatalogSort);
      }

      // Only when the options are rendered: before categories load, the select can only say "All categories".
      const categoryField = this.categoryField().nativeElement;
      const category = categoryField.value || null;

      if (categoryField.options.length > 1 && !query.search && category !== query.category) {
        this.categoryChange.emit(category);
      }
    });

    let firstRun = true;
    effect(() => {
      const query = this.query();

      if (firstRun) {
        firstRun = false;

        return;
      }

      untracked(() => {
        syncFieldValue(this.searchField().nativeElement, query.search);
        syncFieldValue(this.categoryField().nativeElement, query.category ?? '');
        syncFieldValue(this.sortField().nativeElement, query.sort);
      });
    });

    toObservable(this.searchTerm)
      .pipe(
        map((term) => term.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((term) => {
        if (term !== this.query().search) {
          this.searchChange.emit(term);
        }
      });
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.categoryChange.emit(value || null);
  }

  protected onSortChange(event: Event): void {
    this.sortChange.emit((event.target as HTMLSelectElement).value as CatalogSort);
  }
}
