#!/usr/bin/env node
// 从 CSV 生成 /spreadsheet1 数据集（catalog-data-1）的商品详情文件：
// 每个 sourceProductId 一个 JSON，供 /product1/:id 按需加载。
// id 对齐规则见 scripts/lib/catalog-new-dataset.mjs（以 new link 列为准）。
import fs from "node:fs/promises";
import path from "node:path";
import { readCatalogNewDataset } from "./lib/catalog-new-dataset.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const csvPath = process.argv[2] || "d:/ps/catalog-new.csv";
const outputDir = path.join(root, "client/public/catalog-data-1/products");

const splitList = (value, separator = "|") =>
  String(value || "").split(separator).map((entry) => entry.trim()).filter(Boolean);

const { rows, stats } = readCatalogNewDataset(csvPath);

const groups = new Map();
for (const row of rows) {
  const sourceProductId = row.sourceProductId || row.id;
  if (!groups.has(sourceProductId)) groups.set(sourceProductId, []);
  groups.get(sourceProductId).push(row);
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

let totalBytes = 0;
for (const [sourceProductId, groupRows] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const first = groupRows[0];
  const gallery = [];
  const styles = groupRows.map((row) => {
    const images = splitList(row.images);
    for (const image of images) if (!gallery.includes(image)) gallery.push(image);
    return {
      id: row.id,
      styleKey: row.styleKey,
      styleLabel: row.styleLabel,
      price: Number(row.price) || 0,
      currency: row.currency || "USD",
      sizes: splitList(row.sizes),
      colors: splitList(row.colors),
      stock: row.stock,
      images,
      description: row.description,
    };
  });
  const payload = {
    sourceProductId,
    name: first.name,
    catalogName: first.catalogName,
    brand: first.brand,
    category: first.category,
    subCategory: first.subCategory,
    shopUrl: first.shopUrl,
    productUrl: first.url,
    refreshed: String(first.priceCheckedAt || "").slice(0, 10),
    gallery,
    styles,
  };
  const serialized = JSON.stringify(payload);
  await fs.writeFile(path.join(outputDir, `${sourceProductId}.json`), serialized);
  totalBytes += Buffer.byteLength(serialized, "utf8");
}

console.log(
  `PRODUCTS=${groups.size} ROWS=${rows.length} TOTAL_MB=${(totalBytes / 1024 / 1024).toFixed(2)} ` +
  `REKEYED=${stats.rekeyedProducts} DEDUPED=${stats.dedupedRows} -> ${path.relative(root, outputDir)}`,
);
