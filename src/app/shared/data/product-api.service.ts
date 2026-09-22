import {HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {map, Observable} from 'rxjs';
import * as v from 'valibot';

import {ApiError} from '../../core/error/api.error';
import {API_ENDPOINTS, API_URL} from '../../core/http/api.config';
import {CatalogQuery, toCatalogApiRequest} from '../model/catalog-query';
import {
  categoriesResponseSchema,
  Category,
  Product,
  PRODUCT_FIELDS,
  productSchema,
  productsResponseSchema,
} from '../model/product.model';

export interface CatalogPage {
  products: Product[];
  total: number;
}

function parse<TSchema extends v.GenericSchema>(schema: TSchema, response: unknown): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, response);

  if (!result.success) {
    throw new ApiError('parse', `API response does not match the schema: ${result.issues[0]?.message ?? ''}`);
  }

  return result.output;
}

/** Thin layer over HTTP: knows endpoints and schemas, nothing about caching. */
@Injectable({providedIn: 'root'})
export class ProductApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  public getPage(query: CatalogQuery): Observable<CatalogPage> {
    const request = toCatalogApiRequest(query, PRODUCT_FIELDS);

    return this.http.get<unknown>(`${this.apiUrl}/${request.path}`, {params: request.params}).pipe(
      map((response) => parse(productsResponseSchema, response)),
      map(({products, total}) => ({products, total}))
    );
  }

  public getProduct(id: number): Observable<Product> {
    return this.http
      .get<unknown>(`${this.apiUrl}/${API_ENDPOINTS.product(id)}`, {
        params: {select: PRODUCT_FIELDS.join(',')},
      })
      .pipe(map((response) => parse(productSchema, response)));
  }

  public getCategories(): Observable<Category[]> {
    return this.http
      .get<unknown>(`${this.apiUrl}/${API_ENDPOINTS.categories}`)
      .pipe(map((response) => parse(categoriesResponseSchema, response)));
  }

  public cartSyncUrl(): string {
    return `${this.apiUrl}/${API_ENDPOINTS.cartsAdd}`;
  }
}
