#!/usr/bin/env node
// 从 CSV 生成 /spreadsheet1 数据集（catalog-data-1）的商品详情文件：
// 每个 sourceProductId 一个 JSON，供 /product1/:id 按需加载。
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const csvPath = process.argv[2] || "d:/ps/catalog-new.csv";
const outputDir = path.join(root, "client/public/catalog-data-1/products");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const splitList = (value, separator = "|") =>
  String(value || "").split(separator).map((entry) => entry.trim()).filter(Boolean);

const text = (await fs.readFile(csvPath, "utf8")).replace(/^\ufeff/, "");
const rows = parseCsv(text).filter((r) => r.length > 1 && r.join("").trim());
const header = rows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const col = (row, key) => String(row[idx[key]] ?? "").trim();

const groups = new Map();
for (const row of rows) {
  const sourceProductId = col(row, "sourceProductId") || col(row, "id");
  if (!groups.has(sourceProductId)) groups.set(sourceProductId, []);
  groups.get(sourceProductId).push(row);
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const names = new Map();
let totalBytes = 0;
for (const [sourceProductId, groupRows] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const first = groupRows[0];
  const gallery = [];
  const styles = groupRows.map((row) => {
    const images = splitList(col(row, "images"));
    for (const image of images) if (!gallery.includes(image)) gallery.push(image);
    return {
      id: col(row, "id"),
      styleKey: col(row, "styleKey"),
      styleLabel: col(row, "styleLabel"),
      price: Number(col(row, "price")) || 0,
      currency: col(row, "currency") || "USD",
      sizes: splitList(col(row, "sizes")),
      colors: splitList(col(row, "colors")),
      stock: col(row, "stock"),
      images,
      description: col(row, "description"),
    };
  });
  const payload = {
    sourceProductId,
    name: col(first, "name"),
    catalogName: col(first, "catalogName"),
    brand: col(first, "brand"),
    category: col(first, "category"),
    subCategory: col(first, "subCategory"),
    shopUrl: col(first, "shopUrl"),
    productUrl: col(first, "url"),
    refreshed: col(first, "priceCheckedAt").slice(0, 10),
    gallery,
    styles,
  };
  const serialized = JSON.stringify(payload);
  names.set(sourceProductId, payload.name);
  await fs.writeFile(path.join(outputDir, `${sourceProductId}.json`), serialized);
  totalBytes += Buffer.byteLength(serialized, "utf8");
}

console.log(`PRODUCTS=${groups.size} ROWS=${rows.length} TOTAL_MB=${(totalBytes / 1024 / 1024).toFixed(2)} -> ${path.relative(root, outputDir)}`);
