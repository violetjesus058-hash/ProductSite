import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const listPath = path.resolve("scripts/kakobuy-cover-download-list.json");
const outputDir = "/home/ubuntu/webdev-static-assets/product-images";
const reportPath = path.resolve("scripts/kakobuy-cover-download-report.json");
const list = JSON.parse(await fs.readFile(listPath, "utf8"));
const items = list.items.filter((item) => !item.local_path);
await fs.mkdir(outputDir, { recursive: true });
const concurrency = 12;
let cursor = 0;
const results = [];
const extensionFor = (contentType, url) => {
  const type = (contentType || "").split(";")[0].toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
};
const worker = async () => {
  while (true) {
    const index = cursor++;
    if (index >= items.length) return;
    const item = items[index];
    let result = { product_id: item.product_id, url: item.url, ok: false, attempts: 0 };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      result.attempts = attempt;
      try {
        const response = await fetch(item.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 ProductCatalogAssetFetcher/1.0" }, signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`Not an image: ${contentType}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 256) throw new Error(`Image too small: ${buffer.length}`);
        const digest = crypto.createHash("sha1").update(item.url).digest("hex").slice(0, 20);
        const target = path.join(outputDir, `${digest}${extensionFor(contentType, item.url)}`);
        await fs.writeFile(target, buffer);
        result = { ...result, ok: true, path: target, bytes: buffer.length, contentType };
        break;
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    results[index] = result;
    if ((index + 1) % 50 === 0 || index + 1 === items.length) console.log(`${index + 1}/${items.length}`);
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));
await fs.writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), requested: items.length, success: results.filter((item) => item?.ok).length, failed: results.filter((item) => item && !item.ok).length, results }, null, 2));
console.log(JSON.stringify({ requested: items.length, success: results.filter((item) => item?.ok).length, failed: results.filter((item) => item && !item.ok).length }));
