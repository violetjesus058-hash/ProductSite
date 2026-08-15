import fs from 'node:fs';

const path = 'client/src/data/products.ts';
let source = fs.readFileSync(path, 'utf8');
const before = source;
source = source.replaceAll(/\/manus-storage\/([^" ]+)/g, (_, name) => `/product-images/${name.replace(/\.[^.]+$/, '')}.webp`);
source = source.replaceAll(/\/product-images\/([^" ]+)\.(?:jpg|jpeg|png|gif)\.webp/g, '/product-images/$1.webp');
const replaced = (before.match(/\/manus-storage\//g) || []).length;
fs.writeFileSync(path, source);
console.log(JSON.stringify({ replaced, remainingManusRefs: (source.match(/\/manus-storage\//g) || []).length }));
