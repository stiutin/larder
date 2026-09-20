import {Component, OnInit, inject, ChangeDetectionStrategy} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {
  MatCard,
  MatCardContent,
  MatCardHeader,
  MatCardImage,
  MatCardSubtitle,
  MatCardTitle,
} from '@angular/material/card';
import {Store} from '@ngrx/store';
import {Observable} from 'rxjs';
import * as PhotoSelectors from '../../store/selectors';
import {IProduct} from '../../shared/entities/interfaces/product.interface';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
  imports: [AsyncPipe, MatCard, MatCardContent, MatCardHeader, MatCardImage, MatCardSubtitle, MatCardTitle],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class ProductComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly titleService = inject(Title);
  protected product$: Observable<IProduct>;
  private productId: number;

  constructor() {
    this.titleService.setTitle('Esto App | Cart');
  }

  public ngOnInit(): void {
    this.productId = +this.route.snapshot.paramMap.get('id');
    this.product$ = this.store.select(PhotoSelectors.selectPhotoById(this.productId));
  }
}
