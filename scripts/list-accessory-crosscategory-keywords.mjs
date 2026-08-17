import fs from "node:fs";
const source = fs.readFileSync(new URL("../client/src/data/products.ts", import.meta.url), "utf8");
const start = source.indexOf("= [", source.indexOf("export const products")) + 2;
const json = JSON.parse(source.slice(start, source.lastIndexOf("] as Product[]")) + "]");
const rows = new Map();
const pattern = /(shoe|sneaker|pants|shorts|shirt|jersey|jacket|hoodie|sweater|suit|underwear|sock|dress|clothing|trouser|sandal|slipper|coat|outfit|set|男装|鞋|裤|短裤|衣|服|套装|袜|内裤)/i;
for (const item of json) {
  if (item.category !== "ACC" || !pattern.test(item.name)) continue;
  const sourceProductId = item.sourceProductId || item.id;
  if (!rows.has(sourceProductId)) rows.set(sourceProductId, { sourceProductId, name: item.name, image: item.images?.[0] || "" });
}
console.log(JSON.stringify([...rows.values()], null, 2));
