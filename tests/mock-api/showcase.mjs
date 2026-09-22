/**
 * A realistic-looking pantry catalogue for screenshots and local demos (MOCK_DATASET=showcase).
 * Images are generated SVG illustrations served by scripts/screenshots.mjs, not real product photos.
 */
const items = [
  ['Stoneware Coffee Mug', 'kitchen', 14, 'Hand-glazed, 350 ml, dishwasher safe.'],
  ['Cast Iron Skillet', 'kitchen', 42, 'Pre-seasoned 26 cm pan that lasts a lifetime.'],
  ['Oak Cutting Board', 'kitchen', 36, 'End-grain oak, oiled and ready to use.'],
  ['Glass Storage Jars', 'kitchen', 24, 'Set of three airtight jars for dry goods.'],
  ['Linen Apron', 'kitchen', 29, 'Stonewashed linen with a deep front pocket.'],
  ['Enamel Tea Kettle', 'kitchen', 48, 'Whistling kettle for gas, electric and induction.'],
  ['Ceramic Planter', 'home-decor', 22, 'Matte ceramic pot with a drainage hole.'],
  ['Wool Throw Blanket', 'home-decor', 68, 'Soft merino throw in warm terracotta.'],
  ['Beeswax Candles', 'home-decor', 16, 'Pair of hand-dipped tapers, 25 cm.'],
  ['Woven Storage Basket', 'home-decor', 31, 'Seagrass basket for blankets and toys.'],
  ['Brass Table Lamp', 'home-decor', 89, 'Warm dimmable light with a linen shade.'],
  ['Wall Clock', 'home-decor', 45, 'Silent sweep movement, beech frame.'],
  ['Wildflower Honey', 'groceries', 11, 'Raw honey from small local apiaries.'],
  ['Sourdough Flour', 'groceries', 7, 'Stone-milled wheat, 2 kg bag.'],
  ['Extra Virgin Olive Oil', 'groceries', 18, 'Cold-pressed, early harvest, 750 ml.'],
  ['Dark Chocolate Bar', 'groceries', 5, '72% cocoa, single origin.'],
  ['Loose Leaf Green Tea', 'groceries', 13, 'Sencha in a resealable tin, 100 g.'],
  ['Sea Salt Flakes', 'groceries', 6, 'Hand-harvested pyramid flakes, 250 g.'],
  ['Espresso Beans', 'groceries', 17, 'Medium roast, notes of cocoa and cherry.'],
  ['Strawberry Jam', 'groceries', 8, 'Small-batch jam with 65% fruit.'],
  ['Picnic Blanket', 'outdoors', 39, 'Water-resistant backing, folds into a strap.'],
  ['Insulated Bottle', 'outdoors', 27, 'Keeps drinks cold for 24 hours.'],
  ['Camping Lantern', 'outdoors', 34, 'Rechargeable LED lantern with three modes.'],
  ['Enamel Camp Mug', 'outdoors', 12, 'Speckled enamel, light and unbreakable.'],
];

export const showcase = items.map(([title, category, price, description], index) => ({
  category,
  description,
  discountPercentage: index % 4 === 0 ? 15 : index % 5 === 0 ? 8 : 0,
  id: index + 1,
  price,
  rating: Math.round((4 + ((index * 37) % 10) / 10) * 10) / 10,
  stock: 3 + (index % 9),
  thumbnail: `https://cdn.dummyjson.com/showcase/${index + 1}.svg`,
  title,
}));
