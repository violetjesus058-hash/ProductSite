import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("client/src/data/products.ts");
const reportPath = path.resolve("scripts/product-image-download-report.json");
const uploadLogPath = path.resolve("scripts/product-image-upload.log");

const source = await fs.readFile(sourcePath, "utf8");
const jsonStart = source.indexOf("export const products: Product[] = [") + "export const products: Product[] = ".length;
const jsonEnd = source.indexOf("] as Product[];", jsonStart);
const jsonText = source.slice(jsonStart, jsonEnd + 1);
const products = JSON.parse(jsonText);
const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
const uploadLog = await fs.readFile(uploadLogPath, "utf8");

const localByUrl = new Map(report.results.filter((item) => item.ok).map((item) => [item.url, item.path]));
const storageByLocal = new Map();
for (const line of uploadLog.split("\n")) {
  const match = line.match(/^\[SUCCESS\] (.+?) -> (\/manus-storage\/\S+)$/);
  if (match) storageByLocal.set(match[1], match[2]);
}

const storageByUrl = new Map();
for (const [url, localPath] of localByUrl) {
  const storagePath = storageByLocal.get(localPath);
  if (storagePath) storageByUrl.set(url, storagePath);
}

let replaced = 0;
let omitted = 0;
let unresolved = [];
for (const product of products) {
  const localImages = [];
  for (const url of product.images ?? []) {
    const storagePath = storageByUrl.get(url);
    if (storagePath) {
      localImages.push(storagePath);
      replaced++;
    } else {
      unresolved.push({ id: product.id, url });
    }
  }
  const deduped = [...new Set(localImages)];
  if (deduped.length === 0) {
    throw new Error(`Product ${product.id} has no successfully hosted image`);
  }
  omitted += (product.images?.length ?? 0) - deduped.length;
  product.images = deduped;
}

const output = `${source.slice(0, jsonStart)}${JSON.stringify(products, null, 2)}\n];\n`;
await fs.writeFile(sourcePath, output);
await fs.writeFile(path.resolve("scripts/product-image-url-replacement-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  products: products.length,
  replaced,
  omitted,
  unresolved,
  hostedMappings: storageByUrl.size,
}, null, 2));
console.log(JSON.stringify({ products: products.length, hostedMappings: storageByUrl.size, replaced, omitted, unresolved }, null, 2));
