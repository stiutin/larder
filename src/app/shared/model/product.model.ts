import * as v from 'valibot';

/**
 * TypeScript types vanish at runtime, so API responses are checked against a schema.
 * `http.get<Product[]>()` is a promise, not a check.
 */
export const productSchema = v.object({
  category: v.string(),
  description: v.string(),
  discountPercentage: v.optional(v.number(), 0),
  id: v.number(),
  price: v.number(),
  rating: v.number(),
  stock: v.optional(v.number(), 0),
  thumbnail: v.pipe(v.string(), v.url()),
  title: v.string(),
});

export const productsResponseSchema = v.object({
  limit: v.number(),
  products: v.array(productSchema),
  skip: v.number(),
  total: v.number(),
});

/** dummyjson has served categories both as plain slugs and as objects. Accept both and normalise. */
export const categoriesResponseSchema = v.array(
  v.union([
    v.pipe(
      v.string(),
      v.transform((slug) => ({name: slug, slug}))
    ),
    v.object({name: v.string(), slug: v.string()}),
  ])
);

export const PRODUCT_FIELDS = [
  'title',
  'description',
  'category',
  'price',
  'discountPercentage',
  'rating',
  'stock',
  'thumbnail',
] as const;

export type Product = v.InferOutput<typeof productSchema>;
export type ProductsResponse = v.InferOutput<typeof productsResponseSchema>;
export type Category = v.InferOutput<typeof categoriesResponseSchema>[number];
