import fs from 'node:fs';
import path from 'node:path';

const productFile = path.resolve('/home/ubuntu/product-catalog-site/client/src/data/products.ts');
const text = fs.readFileSync(productFile, 'utf8');
const jsonStart = text.indexOf('export const products: Product[] = [') + 'export const products: Product[] = '.length;
const jsonEnd = text.indexOf('] as Product[];', jsonStart) + 1;
const products = JSON.parse(text.slice(jsonStart, jsonEnd));
const identifier = /^(catalog item\s+kb-|kakobuy product\s+\d+|product\s*[-_]?\d+|kb-\d+)/i;
const suspicious = products.filter((p) => identifier.test(String(p.name || '').trim()));
const sources = new Map();
for (const p of suspicious) {
  const key = p.sourceProductId || p.id;
  if (!sources.has(key)) sources.set(key, { sourceProductId: key, name: p.name, catalogName: p.catalogName, category: p.category, subCategory: p.subCategory, id: p.id });
}
console.log(JSON.stringify({ groupedProducts: products.length, identifierTitleRows: suspicious.length, uniqueSources: sources.size, samples: [...sources.values()].slice(0, 80) }, null, 2));
