import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const source = await fs.readFile(path.join(root, "client/src/data/products.ts"), "utf8");
const allIds = [...new Set([...source.matchAll(/\"id\"\s*:\s*\"([^\"]+)\"/g)].map((match) => match[1]))];
const ids = process.env.PRICE_IDS ? process.env.PRICE_IDS.split(",").map((value) => value.trim()).filter(Boolean) : allIds;
const outputPath = path.join(root, "scripts/fansbuy-rendered-price-report.json");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parsePrice = (html, patterns) => {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return Number.parseFloat(match[1].replace(/,/g, ""));
  }
  return null;
};
const crawlOne = async (id) => {
  const url = `https://fansbuy.com/item-micro-${id}.html?promotionCode=R0dfTU9DRzA2VTk`;
  try {
    const { stdout } = await execFileAsync("/usr/bin/chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--dump-dom", "--virtual-time-budget=8000", url], { timeout: 20000, maxBuffer: 12 * 1024 * 1024 });
    const usd = parsePrice(stdout, [/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/, /&dollar;\s*([0-9]+(?:\.[0-9]{1,2})?)/i]);
    const rmb = parsePrice(stdout, [/￥\s*([0-9]+(?:\.[0-9]{1,2})?)/, /¥\s*([0-9]+(?:\.[0-9]{1,2})?)/]);
    return { id, url, usd, rmb, ok: usd !== null, capturedAt: new Date().toISOString(), error: usd === null ? "Rendered USD price not found" : undefined };
  } catch (error) {
    return { id, url, usd: null, rmb: null, ok: false, capturedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
  }
};
const results = [];
for (let index = 0; index < ids.length; index += 1) {
  const result = await crawlOne(ids[index]);
  results.push(result);
  console.log(`${index + 1}/${ids.length} ${result.id} usd=${result.usd ?? "NA"} rmb=${result.rmb ?? "NA"} ${result.error ? `error=${result.error}` : "ok"}`);
  await fs.writeFile(outputPath, JSON.stringify({ source: "Chromium rendered DOM", total: results.length, expected: ids.length, results }, null, 2));
  await sleep(3500);
}
console.log(`Saved ${results.length} results to ${outputPath}`);
