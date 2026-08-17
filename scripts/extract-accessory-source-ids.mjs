import fs from "node:fs";

const source = fs.readFileSync(new URL("../client/src/data/products.ts", import.meta.url), "utf8");
const arrayStart = source.indexOf("= [", source.indexOf("export const products")) + 2;
const arrayText = source.slice(arrayStart, source.lastIndexOf("] as Product[]")) + "]";
const json = JSON.parse(arrayText);
const ids = [...new Set(json.filter((item) => item.category === "ACC").map((item) => item.sourceProductId || item.id))];
fs.writeFileSync(new URL("./accessories-source-ids.json", import.meta.url), JSON.stringify(ids));
console.log(JSON.stringify({ count: ids.length, output: "scripts/accessories-source-ids.json" }));
