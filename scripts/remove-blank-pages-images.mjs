import fs from 'node:fs';

const dataPath = 'client/src/data/products.ts';
const reportPath = 'scripts/blank-pages-images.json';
const blocked = JSON.parse(fs.readFileSync(reportPath, 'utf8')).map((item) => `/product-images/${item.file}`);
let source = fs.readFileSync(dataPath, 'utf8');
let removed = 0;
for (const url of blocked) {
  const before = source;
  source = source.replaceAll(`      "${url}",\n`, '');
  if (source !== before) removed += 1;
}
fs.writeFileSync(dataPath, source);
console.log(JSON.stringify({ blocked: blocked.length, removed, remaining: blocked.filter((url) => source.includes(`"${url}"`)).length }, null, 2));
