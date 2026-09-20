import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {apiUrl} from '../entities/constants/common.const';
import {IResponse} from '../entities/interfaces/product.interface';
import {EUrlEndpoints} from '../entities/enums/url.enum';

@Injectable({
  providedIn: 'root',
})
export class ProductDataService {
  private readonly http = inject(HttpClient);

  public getProducts(): Observable<IResponse> {
    return this.http.get<IResponse>(`${apiUrl}${EUrlEndpoints.Products}/?limit=0`);
  }
}
