import {expect, test} from './fixtures';

test.describe('catalogue', () => {
  test('search and sorting live in the URL and survive a reload', async ({page, writes: _}) => {
    await page.goto('/');
    await page.getByRole('searchbox', {name: /Search/}).fill('product 1');
    await expect(page).toHaveURL(/q=product\+1|q=product%201/);

    await page.getByRole('combobox', {name: /Sort/}).selectOption('price-desc');
    await expect(page).toHaveURL(/sort=price-desc/);
    const first = await page.getByRole('heading', {level: 2}).first().textContent();

    await page.reload();
    await expect(page.getByRole('searchbox', {name: /Search/})).toHaveValue('product 1');
    await expect(page.getByRole('heading', {level: 2}).first()).toHaveText(first ?? '');
  });

  test('a value that lands in the search box before the app is interactive is not lost', async ({page, writes: _}) => {
    let release: () => void = () => undefined;
    const appScriptHeld = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/main-*.js', async (route) => {
      await appScriptHeld;
      await route.continue();
    });

    await page.goto('/', {waitUntil: 'commit'});
    const search = page.locator('input[type=search]');
    await search.waitFor();

    await search.evaluate((input: HTMLInputElement) => {
      input.value = 'product 1';
    });
    release();

    await expect(page).toHaveURL(/q=product\+1|q=product%201/);
  });

  test('the first page arrives server-rendered, with paging', async ({page, writes: _}) => {
    const response = await page.request.get('/');
    const html = await response.text();

    expect(html).toContain('Test product 1<');
    expect(html).toContain('Page 1 of 3');

    await page.goto('/');
    await page.getByRole('button', {name: 'Next'}).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText('Page 2 of 3')).toBeVisible();
  });

  test('a product page opens directly, without visiting the catalogue first', async ({page, writes: _}) => {
    await page.goto('/product/7');

    await expect(page.getByRole('heading', {level: 1, name: 'Test product 7'})).toBeVisible();
    await expect(page).toHaveTitle('Test product 7 · Larder');
  });

  test('unknown pages return 404 with a way back', async ({page, writes: _}) => {
    const response = await page.goto('/definitely-missing');

    expect(response?.status()).toBe(404);
    await page
      .getByRole('link', {name: /catalogue/i})
      .first()
      .click();
    await expect(page).toHaveURL('/');
  });
});
