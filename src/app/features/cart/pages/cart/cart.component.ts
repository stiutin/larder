import {CurrencyPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, inject, OnInit} from '@angular/core';
import {MatAnchor, MatButton} from '@angular/material/button';
import {RouterLink} from '@angular/router';

import {NetworkStatusService} from '../../../../core/offline/network-status.service';
import {OutboxSyncService} from '../../../../core/offline/outbox-sync.service';
import {CartStore} from '../../store/cart.store';
import {CartLineComponent} from '../../ui/cart-line.component';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
  imports: [CartLineComponent, CurrencyPipe, DatePipe, MatAnchor, MatButton, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent implements OnInit {
  protected readonly cart = inject(CartStore);
  protected readonly sync = inject(OutboxSyncService);
  protected readonly online = inject(NetworkStatusService).online;

  public ngOnInit(): void {
    this.cart.reconcile();
  }
}
