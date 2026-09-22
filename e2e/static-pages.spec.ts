import {expect, test} from './fixtures';

test.describe('About and Contact (prerendered)', () => {
  test('About arrives as static HTML and links into the catalogue', async ({page, writes: _}) => {
    const html = await (await page.request.get('/about')).text();
    expect(html).toContain('A pantry for the moments when the network runs dry');

    await page.goto('/about');
    await expect(page).toHaveTitle('About us · Larder');
    await page
      .getByRole('link', {name: /catalogue/i})
      .first()
      .click();
    await expect(page).toHaveURL('/');
  });

  test('Contact validates, then sends', async ({page, writes}) => {
    await page.goto('/contact');
    await page.getByRole('button', {name: 'Send message'}).click();
    await expect(page.getByText('Please tell us your name.')).toBeVisible();
    await expect(page.getByRole('textbox', {name: /^Name/})).toBeFocused();

    await page.getByRole('textbox', {name: /^Name/}).fill('Ada Lovelace');
    await page.getByRole('textbox', {name: /^Email/}).fill('ada@example.com');
    await page.getByRole('textbox', {name: /^Message/}).fill('The offline cart is a lovely touch.');
    await page.getByRole('button', {name: 'Send message'}).click();

    await expect(page.getByText(/on its way/)).toBeVisible();
    expect(writes.some((request) => request.url().endsWith('/posts/add'))).toBe(true);
  });

  test('Contact offline: the message is kept and delivered on reconnect', async ({network, page, writes}) => {
    await page.goto('/contact');
    await network.goOffline();

    await page.getByRole('textbox', {name: /^Name/}).fill('Ada Lovelace');
    await page.getByRole('textbox', {name: /^Email/}).fill('ada@example.com');
    await page.getByRole('textbox', {name: /^Message/}).fill('Sent from a tunnel, delivered later.');
    await page.getByRole('button', {name: 'Send message'}).click();
    await expect(page.getByText('Saved on this device.')).toBeVisible();

    await network.goOnline();
    await expect.poll(() => writes.some((request) => request.url().endsWith('/posts/add'))).toBe(true);
  });
});
