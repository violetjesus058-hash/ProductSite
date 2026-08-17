import fs from "node:fs";
const source = fs.readFileSync(new URL("../client/src/data/products.ts", import.meta.url), "utf8");
const start = source.indexOf("= [", source.indexOf("export const products")) + 2;
const json = JSON.parse(source.slice(start, source.lastIndexOf("] as Product[]")) + "]");
const rows = new Map();
for (const item of json) {
  if (item.category !== "ACC") continue;
  const sourceProductId = item.sourceProductId || item.id;
  if (!rows.has(sourceProductId)) rows.set(sourceProductId, { sourceProductId, name: item.name, image: item.images?.[0] || "", subCategory: item.subCategory });
}
console.log(JSON.stringify([...rows.values()], null, 2));
