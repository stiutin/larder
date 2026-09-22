import {CartConflict, CartItem, CartTotals} from '../../../shared/model/cart.model';
import {Product} from '../../../shared/model/product.model';

const CENTS = 100;
const PERCENT = 100;
const MAX_QUANTITY_WITHOUT_STOCK = 99;

/** Money is rounded to cents once at the end, not at every step, so rounding error does not accumulate. */
export function roundMoney(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

export function maxQuantity(item: Pick<CartItem, 'stock'>): number {
  return item.stock > 0 ? item.stock : MAX_QUANTITY_WITHOUT_STOCK;
}

export function clampQuantity(quantity: number, item: Pick<CartItem, 'stock'>): number {
  return Math.min(Math.max(1, Math.trunc(quantity)), maxQuantity(item));
}

export function toCartItem(product: Product, now: number): CartItem {
  return {
    addedAt: now,
    category: product.category,
    discountPercentage: product.discountPercentage,
    productId: product.id,
    quantity: 1,
    stock: product.stock,
    thumbnail: product.thumbnail,
    title: product.title,
    unitPrice: product.price,
  };
}

export function lineTotal(item: CartItem): number {
  return roundMoney(item.unitPrice * item.quantity);
}

export function cartTotals(items: readonly CartItem[]): CartTotals {
  let count = 0;
  let subtotal = 0;
  let discount = 0;

  for (const item of items) {
    const line = item.unitPrice * item.quantity;

    count += item.quantity;
    subtotal += line;
    discount += (line * item.discountPercentage) / PERCENT;
  }

  return {
    count,
    discount: roundMoney(discount),
    subtotal: roundMoney(subtotal),
    total: roundMoney(subtotal - discount),
  };
}

/**
 * `fresh`: product → fresh data, `null` → product is gone, `undefined` / missing key → could not check.
 * A failed check is no reason to touch the cart.
 */
export function detectConflicts(
  items: readonly CartItem[],
  fresh: ReadonlyMap<number, Product | null | undefined>
): CartConflict[] {
  const conflicts: CartConflict[] = [];

  for (const item of items) {
    const product = fresh.get(item.productId);

    if (product === undefined) {
      continue;
    }

    if (product === null) {
      conflicts.push({kind: 'removed', productId: item.productId, title: item.title});
    } else if (roundMoney(product.price) !== roundMoney(item.unitPrice)) {
      conflicts.push({
        kind: 'price-changed',
        newPrice: product.price,
        oldPrice: item.unitPrice,
        productId: item.productId,
        title: item.title,
      });
    }
  }

  return conflicts;
}

/** Merges the persisted cart with anything the user added before hydration finished. */
export function mergeCartItems(persisted: readonly CartItem[], current: readonly CartItem[]): CartItem[] {
  const byId = new Map(persisted.map((item) => [item.productId, item]));

  for (const item of current) {
    byId.set(item.productId, item);
  }

  return [...byId.values()].sort((a, b) => a.addedAt - b.addedAt);
}

/** Request body for the mock `POST /carts/add` on dummyjson. */
export function toCartSyncBody(items: readonly CartItem[]): {
  products: {id: number; quantity: number}[];
  userId: number;
} {
  return {
    products: items.map((item) => ({id: item.productId, quantity: item.quantity})),
    userId: 1,
  };
}
