import {Injectable, signal} from '@angular/core';

@Injectable({providedIn: 'root'})
export class NetworkStatusService {
  public readonly online = signal(typeof navigator === 'undefined' || navigator.onLine !== false);

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }
}
