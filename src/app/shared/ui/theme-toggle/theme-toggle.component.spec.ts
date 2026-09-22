import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {ThemeToggleComponent} from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('cycles system → light → dark → system and remembers the choice', async () => {
    await render(ThemeToggleComponent);
    const button = screen.getByRole('button', {name: /Theme: System/});

    await userEvent.click(button);
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('larder-theme')).toBe('light');

    await userEvent.click(button);
    expect(document.documentElement.dataset['theme']).toBe('dark');

    await userEvent.click(button);
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    expect(localStorage.getItem('larder-theme')).toBeNull();
  });

  it('picks up a saved preference after the first render', async () => {
    localStorage.setItem('larder-theme', 'dark');
    await render(ThemeToggleComponent);

    expect(await screen.findByRole('button', {name: /Theme: Dark/})).toBeTruthy();
  });
});
