import fs from 'node:fs';

const path = 'client/src/data/products.ts';
let source = fs.readFileSync(path, 'utf8');
const blockedImages = [
  '/manus-storage/05c3a94639c69e6fe335_839ab3e4.jpg',
];
let removedImages = 0;
for (const image of blockedImages) {
  const before = source;
  source = source.replaceAll(`      "${image}",\n`, '');
  if (source !== before) removedImages += 1;
}
const beforeNames = source;
source = source.replace(/📏pls add whatsapp[^"\\n]*/gi, '').replace(/pls add whatsapp[:：]?\s*\+?\d+[^"\\n]*/gi, '').replace(/pls contact whatsapp[^"\\n]*/gi, '');
const sanitizedNames = (beforeNames.match(/whatsapp/gi) || []).length;
const descriptionContactPattern = /("description":\s*")[^"]*(?:whatsapp|wa\\.me|discord|customer service|allchinabuy|cssbuy|cnfans|product link)[^"]*(")/gi;
const beforeDescriptions = source;
source = source.replace(descriptionContactPattern, '$1Product details are based on the latest catalog capture.$2');
const sanitizedDescriptions = (beforeDescriptions.match(/"description":\s*"[^"]*(?:whatsapp|wa\\.me|discord|customer service|allchinabuy|cssbuy|cnfans|product link)[^"]*"/gi) || []).length;
fs.writeFileSync(path, source);
console.log(JSON.stringify({ removedImages, sanitizedNames, sanitizedDescriptions, blockedImages }, null, 2));
