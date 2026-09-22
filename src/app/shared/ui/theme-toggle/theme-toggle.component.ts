import {afterNextRender, ChangeDetectionStrategy, Component, computed, DOCUMENT, inject, signal} from '@angular/core';

type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'larder-theme';
const NEXT: Record<ThemePreference, ThemePreference> = {dark: 'system', light: 'dark', system: 'light'};
const LABELS: Record<ThemePreference, string> = {dark: 'Dark', light: 'Light', system: 'System'};

/**
 * Three states: system → light → dark. The choice is stored in localStorage.
 * The server cannot know the choice, so until the first client render the button shows "system",
 * while an inline script in index.html sets the theme attribute itself — no flash.
 */
@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent {
  protected readonly preference = signal<ThemePreference>('system');
  protected readonly label = computed(() => `Theme: ${LABELS[this.preference()]}`);

  private readonly document = inject(DOCUMENT);

  constructor() {
    afterNextRender(() => {
      const saved = this.readSaved();

      if (saved) {
        this.preference.set(saved);
      }
    });
  }

  protected toggle(): void {
    const next = NEXT[this.preference()];

    this.preference.set(next);

    if (next === 'system') {
      delete this.document.documentElement.dataset.theme;
    } else {
      this.document.documentElement.dataset.theme = next;
    }

    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Private mode without localStorage: the theme works until reload.
    }
  }

  private readSaved(): ThemePreference | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      return saved === 'light' || saved === 'dark' ? saved : null;
    } catch {
      return null;
    }
  }
}
