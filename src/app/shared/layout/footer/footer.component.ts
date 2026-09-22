import {ChangeDetectionStrategy, Component} from '@angular/core';

import {APP_NAME} from '../../../core/brand';

/** Static footer. Links are relative (`about`, not `/about`) so they respect the base href on GitHub Pages. Rendered eagerly: it is a few hundred bytes, and deferring it only risked layout shifts. */
@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly appName = APP_NAME;
}
