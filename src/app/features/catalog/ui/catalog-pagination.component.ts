import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-catalog-pagination',
  templateUrl: './catalog-pagination.component.html',
  styleUrl: './catalog-pagination.component.scss',
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPaginationComponent {
  public readonly page = input.required<number>();
  public readonly pageCount = input.required<number>();

  public readonly pageChange = output<number>();
}
