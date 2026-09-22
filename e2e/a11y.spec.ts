import AxeBuilder from '@axe-core/playwright';
import {expect, test} from './fixtures';

/**
 * axe-core in a real browser, in both colour schemes. Unlike the jsdom run in tests/ssr,
 * this one has layout, so colour contrast is checked too.
 */
const PAGES = ['/', '/product/1', '/cart', '/about', '/contact', '/missing'];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${colorScheme} theme`, () => {
    test.use({colorScheme});

    for (const path of PAGES) {
      test(`no WCAG A/AA violations on ${path}`, async ({page, writes: _}) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const {violations} = await new AxeBuilder({page})
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
      });
    }
  });
}

test('keyboard: the skip link moves focus to the main content', async ({page, writes: _}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name: 'Skip to content'})).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
