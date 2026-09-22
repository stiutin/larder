import {provideRouter} from '@angular/router';
import {render, screen} from '@testing-library/angular';

import {AboutComponent} from './about.component';

describe('AboutComponent', () => {
  it('has one h1, the principles and a way into the catalogue', async () => {
    await render(AboutComponent, {providers: [provideRouter([])]});

    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
    expect(screen.getByText('Works offline')).toBeTruthy();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/')).toBe(true);
  });
});
