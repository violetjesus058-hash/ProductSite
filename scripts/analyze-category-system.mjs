import fs from "node:fs";
const source = fs.readFileSync("client/src/data/products.ts", "utf8");
const start = source.indexOf("export const products: Product[] = [") + "export const products: Product[] = ".length;
const end = source.indexOf("] as Product[];", start) + 1;
const products = JSON.parse(source.slice(start, end));
const tally = (items) => Object.entries(items.reduce((m, value) => ((m[value || "(blank)"] = (m[value || "(blank)"] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const standard = new Set(["clothing", "pants", "shoe", "bags", "fragrance", "watches", "ACC"]);
console.log(JSON.stringify({ total: products.length, categories: tally(products.map(p => p.category)), nonStandard: products.filter(p => !standard.has(p.category)).map(p => ({ id: p.id, category: p.category, subCategory: p.subCategory, name: p.name })), subCategories: tally(products.map(p => p.subCategory)), selectionByCategory: tally(products.filter(p => p.subCategory === "Selection").map(p => p.category)), suspected: products.filter(p => p.reviewStatus === "suspected").map(p => ({ id: p.id, category: p.category, subCategory: p.subCategory, name: p.name })) }, null, 2));
