import fs from "node:fs";

const source = fs.readFileSync("client/src/data/products.ts", "utf8");
const start = source.indexOf("export const products: Product[] = [") + "export const products: Product[] = ".length;
const end = source.indexOf("] as Product[];", start) + 1;
const products = JSON.parse(source.slice(start, end));
const targets = [
  ["High-Quality 8004", 15.91],
  ["High-Quality 22", 13.12],
  ["AC10", 23.47],
  ["High-Quality Apparel", 27.97],
  ["High-Quality Short-Sleeve Shirt", 13.12],
  ["High-Quality R*L Hoodie", 42.43],
  ["High-Quality Fashion Versatile Pants", 24.35],
  ["High-Quality Shoes 030", 48.60],
  ["Freps- High-Quality Shoes 005", 112.24],
  ["High-Quality Shoes", 112.24],
];
for (const [title, price] of targets) {
  const matches = products.filter((p) => p.catalogName === title && Math.abs(Number(p.price) - price) < 0.011);
  console.log(JSON.stringify({ title, price, matches: matches.map((p) => ({ id: p.id, sourceProductId: p.sourceProductId, name: p.name, catalogName: p.catalogName, price: p.price, images: p.images })) }));
}
