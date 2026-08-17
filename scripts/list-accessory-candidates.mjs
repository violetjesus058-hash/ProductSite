import fs from "node:fs";
const source = fs.readFileSync(new URL("../client/src/data/products.ts", import.meta.url), "utf8");
const start = source.indexOf("= [", source.indexOf("export const products")) + 2;
const json = JSON.parse(source.slice(start, source.lastIndexOf("] as Product[]")) + "]");
const names = new Set(["Factory High-Quality New Style Sports Suit","REP High Quality 1-es-002","High Quality 1-TS-001","High Quality Set - PST-001","46_60 ￥310 1 high","High-Quality Loose Comfortable Versatile Outfit Fashion","High Quality 5-UN-001","High Quality 1","High-quality men's bracelet","REP High-Quality 4-TS-001","High Quality 2-ST-001","REP High Quality 1-SS-002","High Quality Knitted 3-AT-001","Men's Trendy Breathable Underwear","High-quality men","REP High Quality 4-CL-001","High-Quality Fashionable Shiny Versatile"]);
const rows = json.filter((item) => item.category === "ACC" && names.has(item.name)).map((item) => ({sourceProductId:item.sourceProductId,id:item.id,name:item.name,subCategory:item.subCategory,images:item.images.slice(0,1)}));
console.log(JSON.stringify(rows,null,2));
