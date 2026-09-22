import {product} from '../../../../testing/fixtures';
import {cartTotals, clampQuantity, detectConflicts, mergeCartItems, toCartItem} from './cart.math';

describe('cart math', () => {
  it('sums, applies discounts and rounds to cents once, at the end', () => {
    const items = [
      {...toCartItem(product(1, {price: 9.99}), 1), quantity: 3},
      {...toCartItem(product(2, {discountPercentage: 0, price: 0.1}), 2), quantity: 3}, // 0.1 × 3 float trap
    ];

    expect(cartTotals(items)).toEqual({count: 6, discount: 3, subtotal: 30.27, total: 27.27});
  });

  it('keeps quantity between 1 and the stock left', () => {
    const item = toCartItem(product(1, {stock: 3}), 1);

    expect(clampQuantity(10, item)).toBe(3);
    expect(clampQuantity(0, item)).toBe(1);
    expect(clampQuantity(500, {stock: 0})).toBe(99);
  });

  it('detects price changes and removed products, ignores what could not be checked', () => {
    const items = [1, 2, 3].map((id) => toCartItem(product(id), id));
    const fresh = new Map([
      [1, product(1, {price: 12.5})],
      [2, null],
      [3, undefined],
    ]);

    expect(detectConflicts(items, fresh)).toEqual([
      {kind: 'price-changed', newPrice: 12.5, oldPrice: 10, productId: 1, title: 'Product 1'},
      {kind: 'removed', productId: 2, title: 'Product 2'},
    ]);
    expect(detectConflicts(items, new Map([[1, product(1, {price: 10.001})]]))).toEqual([]);
  });

  it('does not lose items added before hydration finished', () => {
    const persisted = [toCartItem(product(1), 1), toCartItem(product(2), 2)];
    const current = [{...toCartItem(product(2), 3), quantity: 2}];

    expect(mergeCartItems(persisted, current).map((item) => [item.productId, item.quantity])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });
});
