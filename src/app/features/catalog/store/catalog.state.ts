import {ApiError} from '../../../core/error/api.error';
import {DataSource} from '../../../shared/data/product-repository';
import {CatalogQuery, DEFAULT_CATALOG_QUERY} from '../../../shared/model/catalog-query';
import {Category} from '../../../shared/model/product.model';

export type CatalogStatus = 'error' | 'idle' | 'loaded' | 'loading' | 'revalidating' | 'stale';

export interface CatalogState {
  categories: Category[];
  error: ApiError | null;
  fetchedAt: number | null;
  /** Ids of the current page. Products themselves accumulate in the entity map across pages. */
  pageIds: number[];
  query: CatalogQuery;
  source: DataSource | null;
  status: CatalogStatus;
  total: number;
}

export const initialCatalogState: CatalogState = {
  categories: [],
  error: null,
  fetchedAt: null,
  pageIds: [],
  query: DEFAULT_CATALOG_QUERY,
  source: null,
  status: 'idle',
  total: 0,
};
