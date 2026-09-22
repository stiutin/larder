import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {firstValueFrom} from 'rxjs';

import {product, query} from '../../../testing/fixtures';
import {API_URL} from '../../core/http/api.config';
import {ProductApiService} from './product-api.service';

describe('ProductApiService', () => {
  let api: ProductApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), {provide: API_URL, useValue: 'https://api.test'}],
    });
    api = TestBed.inject(ProductApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('requests one page with only the fields the UI needs', async () => {
    const result = firstValueFrom(api.getPage(query({page: 2})));
    const request = http.expectOne((r) => r.url === 'https://api.test/products');

    expect(request.request.params.get('skip')).toBe('20');
    expect(request.request.params.get('select')).toContain('price');
    request.flush({limit: 20, products: [product(21)], skip: 20, total: 21});

    expect(await result).toEqual({products: [product(21)], total: 21});
  });

  it('accepts both category formats the API has used', async () => {
    const result = firstValueFrom(api.getCategories());
    http
      .expectOne('https://api.test/products/categories')
      .flush(['laptops', {name: 'Smartphones', slug: 'smartphones'}]);

    expect(await result).toEqual([
      {name: 'laptops', slug: 'laptops'},
      {name: 'Smartphones', slug: 'smartphones'},
    ]);
  });

  it('turns a response that breaks the contract into a "parse" error', async () => {
    const result = firstValueFrom(api.getProduct(1));
    http.expectOne((r) => r.url === 'https://api.test/products/1').flush({id: 1, title: 42});

    await expect(result).rejects.toMatchObject({kind: 'parse'});
  });
});
