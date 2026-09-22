/**
 * A tiny stand-in for dummyjson with the same response shapes. Pure function, no Node-specific APIs:
 * the SSR tests serve it over HTTP (server.mjs) and Playwright answers browser requests with it directly.
 */

export const products = Array.from({length: 45}, (_, index) => ({
  category: index % 2 ? 'laptops' : 'smartphones',
  description: `Description of product ${index + 1}`,
  discountPercentage: index % 3 ? 5 : 0,
  id: index + 1,
  price: 10 + index,
  rating: 4.2,
  stock: 7,
  thumbnail: `https://cdn.dummyjson.com/test/${index + 1}.webp`,
  title: `Test product ${index + 1}`,
}));

const categories = [
  {name: 'Laptops', slug: 'laptops'},
  {name: 'Smartphones', slug: 'smartphones'},
];

export function handle(method, url, catalogue = products) {
  const page = (list) => {
    // Like dummyjson: limit=0 means "everything".
    const limit = Number(url.searchParams.get('limit') ?? 30) || Infinity;
    const skip = Number(url.searchParams.get('skip') ?? 0);

    return [
      200,
      {limit: Number.isFinite(limit) ? limit : 0, products: list.slice(skip, skip + limit), skip, total: list.length},
    ];
  };

  if (method === 'POST' && ['/carts/add', '/posts/add'].includes(url.pathname)) {
    return [201, {id: 1, ok: true}];
  }
  if (url.pathname === '/products/categories') {
    return [200, categories];
  }
  if (url.pathname === '/products') {
    return page(catalogue);
  }
  if (url.pathname === '/products/search') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    return page(catalogue.filter((item) => item.title.toLowerCase().includes(q)));
  }
  const category = url.pathname.match(/^\/products\/category\/(.+)$/);
  if (category) {
    return page(catalogue.filter((item) => item.category === decodeURIComponent(category[1])));
  }
  const byId = url.pathname.match(/^\/products\/(\d+)$/);
  if (byId) {
    const found = catalogue.find((item) => item.id === Number(byId[1]));
    return found ? [200, found] : [404, {message: 'not found'}];
  }

  return [404, {message: 'unknown'}];
}
