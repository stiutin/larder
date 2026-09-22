import {provideRouter} from '@angular/router';
import {render, screen} from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {product} from '../../../../testing/fixtures';
import {toCartItem} from '../data/cart.math';
import {CartLineComponent} from './cart-line.component';

describe('CartLineComponent', () => {
  it('shows the line total and emits quantity changes', async () => {
    const increment = vi.fn();
    const decrement = vi.fn();
    await render(CartLineComponent, {
      inputs: {item: {...toCartItem(product(4, {price: 12.5, stock: 5}), 1), quantity: 2}},
      on: {decrement, increment},
      providers: [provideRouter([])],
    });

    expect(screen.getByText('$25.00')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', {name: /Increase/}));
    await userEvent.click(screen.getByRole('button', {name: /Decrease/}));

    expect(increment).toHaveBeenCalledWith(4);
    expect(decrement).toHaveBeenCalledWith(4);
  });

  it('cannot go below one or above the stock left', async () => {
    await render(CartLineComponent, {
      inputs: {item: {...toCartItem(product(4, {stock: 2}), 1), quantity: 2}},
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('button', {name: /Increase/})).toHaveProperty('disabled', true);
  });
});
