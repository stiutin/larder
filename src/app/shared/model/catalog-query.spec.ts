import {
  catalogQueryKey,
  pageCount,
  parseCatalogQuery,
  toCatalogApiRequest,
  toCatalogQueryParams,
} from './catalog-query';
import {PRODUCT_FIELDS} from './product.model';

describe('catalog query (URL ⇄ state ⇄ API)', () => {
  it('normalises garbage in the URL to a valid query', () => {
    expect(parseCatalogQuery({category: 'laptops', page: '-5', q: '  phone ', sort: 'drop table'})).toEqual({
      category: null, // search and category are mutually exclusive
      page: 1,
      search: 'phone',
      sort: 'relevance',
    });
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parseCatalogQuery({page: ['3', '9']}).page).toBe(3);
  });

  it('omits defaults from the URL and round-trips everything else', () => {
    expect(toCatalogQueryParams(parseCatalogQuery({}))).toEqual({category: null, page: null, q: null, sort: null});

    const state = {category: 'laptops', page: 3, search: '', sort: 'price-desc' as const};
    const params = Object.fromEntries(
      Object.entries(toCatalogQueryParams(state)).map(([key, value]) => [
        key,
        value === null ? undefined : String(value),
      ])
    );
    expect(parseCatalogQuery(params)).toEqual(state);
  });

  it('builds the search request with paging, sorting and field selection', () => {
    const request = toCatalogApiRequest({category: null, page: 2, search: 'phone', sort: 'price-asc'}, PRODUCT_FIELDS);

    expect(request.path).toBe('products/search');
    expect(request.params).toMatchObject({limit: '20', order: 'asc', q: 'phone', skip: '20', sortBy: 'price'});
    expect(request.params['select']).toContain('thumbnail');
  });

  it('encodes the category slug and sends no sorting for relevance', () => {
    const request = toCatalogApiRequest({category: 'home decor', page: 1, search: '', sort: 'relevance'}, []);

    expect(request.path).toBe('products/category/home%20decor');
    expect(request.params['sortBy']).toBeUndefined();
  });

  it('counts pages and gives every query a distinct cache key', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(41)).toBe(3);
    expect(catalogQueryKey(parseCatalogQuery({page: '1'}))).not.toBe(catalogQueryKey(parseCatalogQuery({page: '2'})));
  });
});
