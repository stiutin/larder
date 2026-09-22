import {expect, test} from './fixtures';

test('cart: quantities, totals and persistence across a reload', async ({page, writes}) => {
  await page.goto('/');
  // Clicks before hydration are replayed afterwards, but a link clicked in that window is a full page load
  // that would discard them. Start once the app is interactive.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: /Add to cart\s*:\s*Test product 1$/}).click();
  await page.getByRole('button', {name: /Add to cart\s*:\s*Test product 2$/}).click();

  await page.getByRole('link', {name: /^Cart/}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Cart'})).toBeVisible();

  await page.getByRole('group', {name: 'Quantity: Test product 1'}).getByRole('button', {name: 'Increase'}).click();
  // Test product 1: 10 × 2 = 20 (no discount); Test product 2: 11 × 1 with 5% off = 10.45 → total 30.45
  await expect(page.getByText('$30.45')).toBeVisible();

  await page.reload();
  await expect(page.getByText('$30.45')).toBeVisible();

  // One debounced snapshot reaches the (mock) server, not one request per click.
  await expect.poll(() => writes.filter((request) => request.url().endsWith('/carts/add')).length).toBeGreaterThan(0);
});
