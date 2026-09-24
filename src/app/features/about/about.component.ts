import {ChangeDetectionStrategy, Component} from '@angular/core';
import {MatAnchor} from '@angular/material/button';
import {RouterLink} from '@angular/router';

import {APP_NAME} from '../../core/brand';

interface Principle {
  icon: string;
  text: string;
  title: string;
}

interface Step {
  text: string;
  title: string;
}

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  imports: [MatAnchor, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  protected readonly appName = APP_NAME;

  protected readonly principles: Principle[] = [
    {
      icon: '⌁',
      text: 'Every page you browse and everything in your cart is kept on your device. No signal, no problem.',
      title: 'Works offline',
    },
    {
      icon: '◷',
      text: 'When you are looking at saved data, we say so - with the exact time it was fetched. No pretending.',
      title: 'Honest about freshness',
    },
    {
      icon: '↯',
      text: 'Every page is prerendered to HTML, so you see products before the JavaScript loads.',
      title: 'Fast first screen',
    },
    {
      icon: '◎',
      text: 'Keyboard, screen readers, reduced motion and AA contrast in both themes are checked automatically.',
      title: 'Accessible by default',
    },
  ];

  protected readonly steps: Step[] = [
    {text: 'Pages are cached on your device as you go. Come back later and they open instantly.', title: 'Browse'},
    {
      text: 'Lose the connection and keep going: the cart lives on your device, not on our server.',
      title: 'Shop offline',
    },
    {
      text: 'Back online, queued changes are delivered and prices re-checked. If something changed, you decide.',
      title: 'Sync',
    },
  ];

  protected readonly stack = [
    'Angular 22',
    'Prerendering (SSG)',
    'NgRx SignalStore',
    'IndexedDB',
    'Service Worker',
    'Vitest',
    'Playwright',
  ];
}
