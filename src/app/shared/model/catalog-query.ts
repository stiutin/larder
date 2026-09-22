import {Params} from '@angular/router';

export const CATALOG_PAGE_SIZE = 20;

export const CATALOG_SORTS = ['relevance', 'price-asc', 'price-desc', 'rating-desc'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Full catalogue state. It lives in the URL, so links can be shared and Back works. */
export interface CatalogQuery {
  category: string | null;
  page: number;
  search: string;
  sort: CatalogSort;
}

export const DEFAULT_CATALOG_QUERY: CatalogQuery = {
  category: null,
  page: 1,
  search: '',
  sort: 'relevance',
};

export interface CatalogApiRequest {
  params: Record<string, string>;
  path: string;
}

const SORT_TO_API: Record<CatalogSort, {order: string; sortBy: string} | null> = {
  'price-asc': {order: 'asc', sortBy: 'price'},
  'price-desc': {order: 'desc', sortBy: 'price'},
  'rating-desc': {order: 'desc', sortBy: 'rating'},
  relevance: null,
};

function isCatalogSort(value: unknown): value is CatalogSort {
  return typeof value === 'string' && (CATALOG_SORTS as readonly string[]).includes(value);
}

function firstString(value: unknown): string | null {
  if (Array.isArray(value)) {
    return firstString(value[0]);
  }

  return typeof value === 'string' ? value : null;
}

/** Any garbage in the URL is normalised to a valid query instead of breaking the page. */
export function parseCatalogQuery(params: Params): CatalogQuery {
  const search = (firstString(params.q) ?? '').trim();
  const category = firstString(params.category)?.trim() || null;
  const sort = firstString(params.sort);
  const page = Number.parseInt(firstString(params.page) ?? '', 10);

  return {
    // Search and category are mutually exclusive: the dummyjson API cannot search within a category.
    category: search ? null : category,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    search,
    sort: isCatalogSort(sort) ? sort : 'relevance',
  };
}

/** Defaults are not written to the URL: `/?page=1&sort=relevance` is just noise. */
export function toCatalogQueryParams(query: CatalogQuery): Params {
  return {
    category: query.category ?? null,
    page: query.page > 1 ? query.page : null,
    q: query.search || null,
    sort: query.sort === 'relevance' ? null : query.sort,
  };
}

export function catalogQueryKey(query: CatalogQuery): string {
  return [query.search, query.category ?? '', query.sort, query.page].join('|');
}

export function toCatalogApiRequest(query: CatalogQuery, fields: readonly string[]): CatalogApiRequest {
  const params: Record<string, string> = {
    limit: String(CATALOG_PAGE_SIZE),
    select: fields.join(','),
    skip: String((query.page - 1) * CATALOG_PAGE_SIZE),
  };

  const sort = SORT_TO_API[query.sort];

  if (sort) {
    params.sortBy = sort.sortBy;
    params.order = sort.order;
  }

  if (query.search) {
    params.q = query.search;

    return {params, path: 'products/search'};
  }

  if (query.category) {
    return {params, path: `products/category/${encodeURIComponent(query.category)}`};
  }

  return {params, path: 'products'};
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
}
