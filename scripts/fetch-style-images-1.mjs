#!/usr/bin/env node
// 抓取 /spreadsheet1 数据集各款式的 SKU 图，输出 scripts/lib/style-images-1.json。
// 数据来源：weidian thor getItemSkuInfo（详情页前端同款接口，无需登录）。
// 只服务 catalog-data-1，与主站的 client/src/data/style-images.ts 互不影响。
//
// 用法：
//   node scripts/fetch-style-images-1.mjs                      # 全量，断点续跑
//   node scripts/fetch-style-images-1.mjs --limit 50           # 只抓 50 个商品（试点）
//   node scripts/fetch-style-images-1.mjs --report             # 只统计当前覆盖率，不发请求
//   node scripts/fetch-style-images-1.mjs --concurrency 1      # 默认 1，建议保持
//
// 风控：单并发 + 请求间 1.5–3.5s 抖动，429/5xx 全局退避，连接级失败长退避；
// 每抓 10 个商品落盘一次，中断后再跑会跳过已有结果。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCatalogNewDatasets } from "./lib/catalog-new-dataset.mjs";
import { loadStyleImageMap } from "./lib/style-image-overlay.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MAP_PATH = path.join(ROOT, "scripts", "lib", "style-images-1.json");

const API_URL = "https://thor.weidian.com/detail/getItemSkuInfo/1.0";
const WD_TOKEN = "d7dafeff";
const TIMEOUT_MS = 20000;

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
};
const REPORT_ONLY = args.includes("--report");
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Math.max(0, parseInt(valueOf("--limit") || "0", 10) || 0);
const OFFSET = Math.max(0, parseInt(valueOf("--offset") || "0", 10) || 0);
const CONCURRENCY = Math.max(1, parseInt(valueOf("--concurrency") || "1", 10) || 1);
const RETRIES = Math.max(0, parseInt(valueOf("--retries") || "3", 10) || 3);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

let globalPauseUntil = 0;

const csvPaths = args.filter((value) => /\.csv$/i.test(value));
const { rows } = readCatalogNewDatasets(
  csvPaths.length ? csvPaths : ["d:/ps/catalog-new.csv", "d:/ps/catalog-new-2.csv", "d:/ps/catalog-new-3.csv"],
);

// sourceProductId → { styleKey → { label, skuIds } }
const targets = new Map();
for (const row of rows) {
  const productId = String(row.sourceProductId || row.id || "").trim();
  const styleKey = String(row.styleKey || "").trim();
  if (!productId || !styleKey) continue;
  const skuIds = String(row.sourceSkuIds || "").split(/[|;]/).map((v) => v.trim()).filter(Boolean);
  if (!targets.has(productId)) targets.set(productId, new Map());
  const styles = targets.get(productId);
  if (!styles.has(styleKey)) {
    styles.set(styleKey, { label: String(row.styleLabel || "").trim(), skuIds });
  }
}

const map = loadStyleImageMap();

function coverage() {
  let stylesHave = 0;
  let stylesTotal = 0;
  let productsHave = 0;
  for (const [productId, styles] of targets) {
    let hit = 0;
    for (const styleKey of styles.keys()) {
      stylesTotal += 1;
      if ((map[productId] || {})[styleKey]) { stylesHave += 1; hit += 1; }
    }
    if (hit === styles.size) productsHave += 1;
  }
  return { stylesHave, stylesTotal, productsHave, productsTotal: targets.size, productsInMap: Object.keys(map).length };
}

if (REPORT_ONLY) {
  const c = coverage();
  console.log(`商品 ${c.productsHave}/${c.productsTotal} 已覆盖（映射表内 ${c.productsInMap} 个）`);
  console.log(`款式 ${c.stylesHave}/${c.stylesTotal} 有专属图（${(c.stylesHave / c.stylesTotal * 100).toFixed(1)}%）`);
  process.exit(0);
}

async function fetchSkuInfos(productId) {
  const param = JSON.stringify({ itemId: productId, needTranslate: true });
  const url = `${API_URL}?param=${encodeURIComponent(param)}&wdtoken=${WD_TOKEN}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Referer: `https://weidian.com/item.html?itemID=${productId}`,
    Accept: "application/json",
  };

  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const now = Date.now();
    if (now < globalPauseUntil) await sleep(globalPauseUntil - now);
    await sleep(jitter(1500, 3500));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers });
      if (res.status === 429 || res.status >= 500) {
        globalPauseUntil = Date.now() + 15_000 + attempt * 10_000;
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const skuInfos = data?.result?.skuInfos;
      if (!Array.isArray(skuInfos)) throw new Error(`Bad payload (status=${JSON.stringify(data?.status)})`);
      return skuInfos;
    } catch (err) {
      lastErr = err;
      const isConnErr = err?.name === "TypeError" || String(err?.message || "").includes("fetch failed");
      const backOff = isConnErr ? 20_000 + attempt * 15_000 : 3_000 * (attempt + 1);
      if (attempt < RETRIES) {
        console.warn(`  [retry ${attempt + 1}/${RETRIES}] ${productId}: ${err?.message || err} — backoff ${Math.round(backOff / 1000)}s`);
        await sleep(backOff);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function styleImagesFrom(skuInfos, styleTargets) {
  // CSV 里的 sourceSkuIds 是旧商品的 SKU，链式收敛到新 id 后已经对不上；
  // 可靠的做法是用款式标题匹配：thor 的 skuInfo.title 形如「01;S」「黑色;M」。
  const bySkuId = new Map();
  const byTitle = new Map();
  for (const entry of skuInfos) {
    const sku = entry?.skuInfo || {};
    const id = String(sku.id || "").trim();
    const img = String(sku.img || "").trim();
    const title = String(sku.title || "").trim();
    if (id && img) bySkuId.set(id, img);
    if (!title || !img) continue;
    const stylePart = title.split(/[;:|]/)[0];
    const k1 = stylePart.trim().toLowerCase();
    const k2 = k1.replace(/\s+/g, "");
    if (k1 && !byTitle.has(k1)) byTitle.set(k1, img);
    if (k2 && k2 !== k1 && !byTitle.has(k2)) byTitle.set(k2, img);
  }
  const out = {};
  for (const [styleKey, target] of styleTargets) {
    const label = String(target.label || "").trim();
    const k1 = label.toLowerCase();
    const k2 = k1.replace(/\s+/g, "");
    const byLabel = (k1 && byTitle.get(k1)) || (k2 && byTitle.get(k2));
    if (byLabel) { out[styleKey] = byLabel; continue; }
    for (const skuId of target.skuIds) {
      const img = bySkuId.get(skuId);
      if (img) { out[styleKey] = img; break; }
    }
  }
  return out;
}

function save() {
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 1), "utf8");
}

const queue = [...targets.entries()]
  .filter(([productId]) => !map[productId])
  .slice(OFFSET, LIMIT ? OFFSET + LIMIT : undefined)
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log(`商品总数 ${targets.size}，已在映射表 ${Object.keys(map).length}，本次待抓 ${queue.length}（并发 ${CONCURRENCY}）`);
if (!queue.length) {
  const c = coverage();
  console.log(`款式 ${c.stylesHave}/${c.stylesTotal} 有专属图`);
  process.exit(0);
}

let cursor = 0;
let done = 0;
let failed = 0;
let stylesAdded = 0;

async function lane() {
  while (true) {
    const index = cursor++;
    if (index >= queue.length) return;
    const [productId, styles] = queue[index];
    try {
      const skuInfos = await fetchSkuInfos(productId);
      const images = styleImagesFrom(skuInfos, styles);
      map[productId] = images;
      stylesAdded += Object.keys(images).length;
    } catch (err) {
      failed += 1;
      console.warn(`  [fail] ${productId}: ${err?.message || err}`);
    }
    done += 1;
    if (done % 10 === 0 || done === queue.length) {
      if (!DRY_RUN) save();
      console.log(`[${done}/${queue.length}] 新增款式图 ${stylesAdded} 失败 ${failed}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, lane));
if (!DRY_RUN) save();

const c = coverage();
console.log(`\n=== 结果 ===`);
console.log(`本次抓取 ${done}，失败 ${failed}，新增款式图 ${stylesAdded}`);
console.log(`商品覆盖 ${c.productsHave}/${c.productsTotal}`);
console.log(`款式覆盖 ${c.stylesHave}/${c.stylesTotal} (${(c.stylesHave / c.stylesTotal * 100).toFixed(1)}%)`);
console.log(`映射文件 ${MAP_PATH}`);
