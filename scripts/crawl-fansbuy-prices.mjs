import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "client/src/data/products.ts");
const outputPath = path.join(root, "scripts/fansbuy-price-report.json");
const source = await fs.readFile(sourcePath, "utf8");
const productIds = [...source.matchAll(/\"id\"\s*:\s*\"([^\"]+)\"/g)].map((match) => match[1]);
const ids = [...new Set(productIds)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value) => Number.parseFloat(String(value).replace(/,/g, ""));
const findPrice = (html, symbols) => {
  const symbolPattern = symbols.map((symbol) => symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(?:${symbolPattern})\\s*([0-9]+(?:[.,][0-9]{1,2})?)`, "i");
  const match = html.match(pattern);
  return match ? normalize(match[1]) : null;
};
const fetchOne = async (id) => {
  const url = `https://fansbuy.com/item-micro-${id}.html?promotionCode=R0dfTU9DRzA2VTk`;
  try {
    const response = await fetch(url, { headers: { "user-agent": "MaterialCatalogPriceAudit/1.0", accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    const usd = findPrice(html, ["$"]); 
    const rmb = findPrice(html, ["¥", "￥"]);
    return { id, url, status: response.status, usd, rmb, ok: response.ok && usd !== null, error: response.ok ? (usd === null ? "USD price not found in HTML" : undefined) : `HTTP ${response.status}` };
  } catch (error) {
    return { id, url, status: 0, usd: null, rmb: null, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
const results = [];
const concurrency = 4;
let cursor = 0;
const worker = async () => {
  while (cursor < ids.length) {
    const index = cursor++;
    const result = await fetchOne(ids[index]);
    results[index] = result;
    if ((index + 1) % 20 === 0 || index === ids.length - 1) console.log(`Checked ${index + 1}/${ids.length}`);
    await sleep(250);
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));
const report = { source: "Fansbuy rendered HTML", capturedAt: new Date().toISOString(), total: results.length, usdConfirmed: results.filter((item) => item.usd !== null).length, rmbConfirmed: results.filter((item) => item.rmb !== null).length, failed: results.filter((item) => !item.ok).length, results };
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ total: report.total, usdConfirmed: report.usdConfirmed, rmbConfirmed: report.rmbConfirmed, failed: report.failed, outputPath }, null, 2));
