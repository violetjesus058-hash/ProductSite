import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployRoot = path.join(root, ".vitepress/dist");
const maxBytes = 25 * 1024 * 1024;

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

try {
  const files = await collectFiles(deployRoot);
  const assets = await Promise.all(files.map(async (file) => ({ file, size: (await fs.stat(file)).size })));
  const oversized = assets.filter((asset) => asset.size > maxBytes).sort((a, b) => b.size - a.size);
  const largest = [...assets].sort((a, b) => b.size - a.size).slice(0, 5);
  console.log(`Checked ${assets.length.toLocaleString()} Cloudflare Pages assets; per-file limit is 25 MiB.`);
  for (const asset of largest) console.log(`  ${(asset.size / 1024 / 1024).toFixed(2).padStart(7)} MiB  ${path.relative(deployRoot, asset.file)}`);
  if (oversized.length) {
    for (const asset of oversized) console.error(`ERROR ${(asset.size / 1024 / 1024).toFixed(2)} MiB exceeds 25 MiB: ${path.relative(deployRoot, asset.file)}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Cloudflare Pages asset validation failed:", error);
  process.exitCode = 1;
}
