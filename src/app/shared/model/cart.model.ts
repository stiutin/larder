/**
 * A cart line stores a price snapshot taken when it was added.
 * The cart must never silently change its total if a product gets more expensive.
 */
export interface CartItem {
  addedAt: number;
  category: string;
  discountPercentage: number;
  productId: number;
  quantity: number;
  stock: number;
  thumbnail: string;
  title: string;
  unitPrice: number;
}

export interface CartTotals {
  count: number;
  discount: number;
  subtotal: number;
  total: number;
}

export type CartConflict =
  | {kind: 'price-changed'; newPrice: number; oldPrice: number; productId: number; title: string}
  | {kind: 'removed'; productId: number; title: string};
