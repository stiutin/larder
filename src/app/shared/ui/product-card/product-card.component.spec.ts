import {provideRouter} from '@angular/router';
import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {product} from '../../../../testing/fixtures';
import {ProductCardComponent} from './product-card.component';

describe('ProductCardComponent', () => {
  it('shows price, rounded discount and rating; the button names the product for screen readers', async () => {
    await render(ProductCardComponent, {
      inputs: {action: 'add', product: product(7, {discountPercentage: 12.6, price: 549, rating: 4.36})},
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('heading', {level: 2, name: 'Product 7'})).toBeTruthy();
    expect(screen.getByText('$549.00')).toBeTruthy();
    expect(screen.getByText('−13%')).toBeTruthy();
    expect(screen.getByText(/4\.4/)).toBeTruthy();
    expect(screen.getByRole('button', {name: /Add to cart\s*:\s*Product 7/})).toBeTruthy();
    expect(screen.getByRole('link', {name: /Details\s*:\s*Product 7/}).getAttribute('href')).toBe('/product/7');
  });

  it('emits the product on "Add" and switches the label once it is in the cart', async () => {
    const added = vi.fn();
    const {rerender} = await render(ProductCardComponent, {
      inputs: {action: 'add', product: product(1)},
      on: {added},
      providers: [provideRouter([])],
    });

    await userEvent.click(screen.getByRole('button', {name: /Add to cart/}));
    expect(added).toHaveBeenCalledWith(expect.objectContaining({id: 1}));

    await rerender({inputs: {action: 'add', inCart: true, product: product(1)}, partialUpdate: true});
    expect(screen.getByRole('button', {name: /Add another/})).toBeTruthy();
  });

  it('on the product page the title is the h1 and there is no link to itself', async () => {
    await render(ProductCardComponent, {
      inputs: {product: product(3), variant: 'page'},
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('heading', {level: 1, name: 'Product 3'})).toBeTruthy();
    expect(screen.queryByRole('link', {name: /Details/})).toBeNull();
  });
});
