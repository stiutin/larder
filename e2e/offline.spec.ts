import {expect, test} from './fixtures';

test('offline: cached pages keep working, the cart queues changes and syncs on reconnect', async ({
  network,
  page,
  writes,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {exact: true, level: 2, name: 'Test product 1'})).toBeVisible();

  // Let the app finish loading first: in production the Service Worker precaches every chunk, but it is blocked
  // in these tests, so going offline mid-load would only test a failed download.
  await page.waitForLoadState('networkidle');
  await network.goOffline();
  await expect(page.getByText('Offline · showing saved data')).toBeVisible();

  // Page 2 was never opened: nothing to show, and the app says so honestly.
  await page.getByRole('button', {name: 'Next'}).click();
  await expect(page.getByText('You are offline and this page is not cached yet.')).toBeVisible();

  // Page 1 is in IndexedDB (written on hydration from the server-rendered state). Back is client-side.
  await page.goBack();
  await expect(page.getByRole('heading', {exact: true, level: 2, name: 'Test product 1'})).toBeVisible();
  await expect(page.getByText(/You are offline\. Data as of/)).toBeVisible();

  const writesBefore = writes.length;
  await page.getByRole('button', {name: /Add to cart\s*:\s*Test product 3$/}).click();
  await expect(page.getByTitle('Some changes have not reached the server yet')).toBeVisible();

  await network.goOnline();
  await expect
    .poll(() => writes.slice(writesBefore).some((request) => request.url().endsWith('/carts/add')))
    .toBe(true);
  await expect(page.getByTitle('Some changes have not reached the server yet')).toBeHidden();
});
