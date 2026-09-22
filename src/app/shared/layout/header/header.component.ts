import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';

import {APP_NAME} from '../../../core/brand';
import {NetworkStatusService} from '../../../core/offline/network-status.service';
import {CartBadgeComponent} from '../../../features/cart/ui/cart-badge/cart-badge.component';
import {ThemeToggleComponent} from '../../ui/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  imports: [CartBadgeComponent, RouterLink, RouterLinkActive, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly appName = APP_NAME;
  protected readonly online = inject(NetworkStatusService).online;
}
