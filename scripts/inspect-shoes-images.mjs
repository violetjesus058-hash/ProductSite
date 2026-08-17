import fs from 'node:fs';
const source = fs.readFileSync(new URL('../client/src/data/products.ts', import.meta.url), 'utf8');
const start = source.indexOf('export const products: Product[] = [');
const end = source.indexOf('] as Product[];', start) + 1;
const arrayStart = source.indexOf('= [', start) + 2;
const products = JSON.parse(source.slice(arrayStart, end));
const shoes = products.filter((p) => p.category === 'shoe');
console.log(JSON.stringify({ totalRows: shoes.length, sourceProducts: new Set(shoes.map((p) => p.sourceProductId)).size }, null, 2));
for (const product of shoes) {
  console.log(JSON.stringify({ id: product.id, sourceProductId: product.sourceProductId, name: product.name, price: product.price, subCategory: product.subCategory, imageCount: product.images.length, primaryImage: product.images[0], candidateImages: product.images.slice(0, 6) }));
}
