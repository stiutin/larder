import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {SwUpdate, VersionReadyEvent} from '@angular/service-worker';
import {filter} from 'rxjs';

/**
 * The Service Worker quietly downloaded a new version — we offer a reload rather than forcing one.
 * Plain buttons, no Material: the banner lives in the root and MatButton would pull ~50 kB into the initial bundle.
 */
@Component({
  selector: 'app-update-banner',
  templateUrl: './update-banner.component.html',
  styleUrl: './update-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateBannerComponent {
  protected readonly updateReady = signal(false);

  private readonly updates = inject(SwUpdate);

  constructor() {
    if (!this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed()
      )
      .subscribe(() => this.updateReady.set(true));
  }

  protected reload(): void {
    document.location.reload();
  }

  protected dismiss(): void {
    this.updateReady.set(false);
  }
}
