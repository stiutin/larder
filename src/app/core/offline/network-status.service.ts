import {Injectable, signal} from '@angular/core';

/**
 * Network status as a signal. `navigator.onLine` can lie towards "online", but "offline" is reliable.
 * Where the property does not exist (SSR, Node) we assume online — otherwise the offline layer would block everything.
 */
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
