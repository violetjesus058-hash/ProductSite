import fs from 'node:fs';
const source = fs.readFileSync(new URL('../client/src/data/products.ts', import.meta.url), 'utf8');
const start = source.indexOf('export const products: Product[] = [');
const end = source.indexOf('] as Product[];', start) + 1;
const arrayStart = source.indexOf('= [', start) + 2;
const products = JSON.parse(source.slice(arrayStart, end));
const targets = new Map([
  ['High-Quality Shirt', 19.10],
  ['REP High-Quality', 11.38],
  ['B Fashion', 28.74],
  ['High-Quality Apparel', 30.47],
  ['High-Quality Fashion', 22.95],
  ['High-Quality Shoes', 112.24],
  ['High-Quality Shoes 030', 67.50],
  ['100ml Fashion Perfume (W2C-101)', 22.18],
  ['High-Quality Fashion Versatile', 17.20],
]);
for (const product of products) {
  const targetPrice = targets.get(product.name);
  if (targetPrice !== undefined && Math.abs(product.price - targetPrice) < 0.001) {
    console.log(JSON.stringify({ id: product.id, sourceProductId: product.sourceProductId, name: product.name, price: product.price, primaryImage: product.images[0], imageCount: product.images.length }));
  }
}
