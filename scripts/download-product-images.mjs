import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const sourceFile = path.resolve("client/src/data/products.ts");
const outputDir = "/home/ubuntu/webdev-static-assets/product-images";
const reportFile = path.resolve("scripts/product-image-download-report.json");
const concurrency = 18;
const retries = 2;

const source = await fs.readFile(sourceFile, "utf8");
const matches = [...source.matchAll(/\"images\":\s*\[([\s\S]*?)\]/g)];
const urls = [];
for (const match of matches) {
  for (const item of match[1].matchAll(/\"([^\"]+)\"/g)) urls.push(item[1]);
}
const uniqueUrls = [...new Set(urls)];
await fs.mkdir(outputDir, { recursive: true });

const extensionFor = (contentType, url) => {
  const type = (contentType || "").split(";")[0].toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "image/avif") return ".avif";
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext) ? ext : ".jpg";
};

const fileFor = (url) => {
  const digest = crypto.createHash("sha1").update(url).digest("hex").slice(0, 20);
  return path.join(outputDir, `${digest}.img`);
};

const results = [];
let cursor = 0;
const worker = async () => {
  while (true) {
    const index = cursor++;
    if (index >= uniqueUrls.length) return;
    const url = uniqueUrls[index];
    let result = { url, ok: false, attempts: 0 };
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      result.attempts = attempt;
      try {
        const response = await fetch(url, {
          redirect: "follow",
          headers: { "user-agent": "Mozilla/5.0 ProductCatalogAssetFetcher/1.0" },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`Not an image: ${contentType}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 256) throw new Error(`Image too small: ${buffer.length}`);
        const ext = extensionFor(contentType, url);
        const target = fileFor(url);
        const finalTarget = target.replace(/\.img$/, ext);
        await fs.writeFile(finalTarget, buffer);
        result = { url, ok: true, path: finalTarget, bytes: buffer.length, contentType, attempts: attempt };
        break;
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        if (attempt <= retries) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    results[index] = result;
    if ((index + 1) % 50 === 0 || index + 1 === uniqueUrls.length) {
      console.log(`${index + 1}/${uniqueUrls.length} processed; success=${results.filter((item) => item?.ok).length}; failed=${results.filter((item) => item && !item.ok).length}`);
    }
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));
await fs.writeFile(reportFile, JSON.stringify({ generatedAt: new Date().toISOString(), sourceCount: urls.length, uniqueCount: uniqueUrls.length, results }, null, 2));
console.log(`Report written to ${reportFile}`);
console.log(JSON.stringify({ sourceCount: urls.length, uniqueCount: uniqueUrls.length, success: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length }, null, 2));
