import {ChangeDetectionStrategy, Component} from '@angular/core';
import {MatAnchor} from '@angular/material/button';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
  imports: [MatAnchor, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
