#!/usr/bin/env node
/**
 * 把商品 CSV 转成 /spreadsheet1 使用的 CatalogSummary 索引
 *
 * 用法：
 *   node scripts/build-catalog-new.mjs [csv路径] [--out 目录]
 * 默认：
 *   csv  = D:\ps\catalog-new.csv
 *   out  = client/public/catalog-data-1
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PLATFORM_NAMES = [
  "Oopbuy", "Kakobuy", "Superbuy", "RizzitGO", "ZentBuy", "LoloBuy", "PikoBuy",
  "BoonBuy", "LoongBuy", "HubbuyCN", "Joyagoo", "EastMallBuy", "Okeyhaul", "PonyBuy",
  "CSSBuy", "AnovaBuy", "MyCNBox", "iTaoBuy", "Didpop", "BBDBuy", "CnShopper", "ESGOBuy",
];
const HIDDEN_PLATFORMS = new Set(["acbuy", "allchinabuy", "mulebuy"]);

const CATEGORY_MAP = {
  clothing: "clothing", clothes: "clothing", tops: "clothing", top: "clothing",
  pants: "pants", pant: "pants", trousers: "pants",
  shoe: "shoe", shoes: "shoe", sneakers: "shoe",
  bags: "bags", bag: "bags",
  watches: "watches", watch: "watches",
  acc: "ACC", accessories: "ACC", accessory: "ACC",
  fragrance: "fragrance",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && n === "\n") i += 1;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [rawHead, ...data] = rows;
  const head = (rawHead || []).map((v) => v.trim().replace(/^\ufeff/, ""));
  return data.map((values) => Object.fromEntries(head.map((key, i) => [key, values[i] ?? ""])));
}

function normalizeCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  return CATEGORY_MAP[key] || key;
}

const splitList = (value) => String(value || "").split(/[|;]/).map((v) => v.trim()).filter(Boolean);

function toSummary(record) {
  const images = splitList(record.images);
  const sizes = splitList(record.sizes);
  const sourceProductId = String(record.sourceProductId || "").trim();
  const isKakobuy = /kakobuy\.com/i.test(record.url || "");
  const platformKeys = PLATFORM_NAMES.filter((name) => !HIDDEN_PLATFORMS.has(name.toLowerCase()));
  return {
    id: String(record.id || "").trim(),
    sourceProductId,
    name: String(record.catalogName || record.name || "").trim(),
    styleKey: String(record.styleKey || "").trim(),
    styleLabel: String(record.styleLabel || "").trim(),
    thumbnail: images[0] || "",
    category: normalizeCategory(record.category),
    subCategory: String(record.subCategory || "").trim(),
    price: Number(record.price) || 0,
    currency: String(record.currency || "USD").trim() || "USD",
    sizeCount: sizes.length,
    platformCount: platformKeys.length,
    primaryPlatform: "Oopbuy",
    platformKeys,
    hasStyleImage: images.length > 1,
    priceCheckedAt: String(record.priceCheckedAt || record.collectedAt || "").trim(),
    _isKakobuy: isKakobuy,
  };
}

function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));
  const csvPath = path.resolve(positional[0] || "D:\\ps\\catalog-new.csv");
  const outArg = positional[1] ? path.resolve(positional[1]) : "client/public/catalog-data-1";
  const verifyOnly = flags.includes("--inspect");

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 不存在：${csvPath}`);
    process.exit(1);
  }

  const records = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const summaries = records.map(toSummary).filter((item) => item.id && item.name);
  const dropped = records.length - summaries.length;

  const categoryCount = {};
  const platformSet = new Set();
  for (const item of summaries) {
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    for (const key of item.platformKeys) platformSet.add(key);
  }

  console.log(`CSV 行数      : ${records.length}`);
  console.log(`生成索引行数  : ${summaries.length}${dropped ? `（丢弃 ${dropped} 行缺 id/name）` : ""}`);
  console.log(`独立商品数    : ${new Set(summaries.map((i) => i.sourceProductId)).size}`);
  console.log(`分类分布      : ${JSON.stringify(categoryCount)}`);
  console.log(`平台数量      : ${platformSet.size}`);
  console.log(`kakobuy url   : ${summaries.filter((i) => i._isKakobuy).length} 行`);
  console.log(`价格区间      : ${Math.min(...summaries.map((i) => i.price))} ~ ${Math.max(...summaries.map((i) => i.price))}`);

  if (verifyOnly) { console.log("\n--inspect 模式，未写文件。"); return; }

  const outDir = path.resolve(outArg);
  fs.mkdirSync(outDir, { recursive: true });
  const clean = summaries.map(({ _isKakobuy, ...rest }) => rest);
  const outFile = path.join(outDir, "catalog-index.json");
  fs.writeFileSync(outFile, JSON.stringify(clean), "utf8");
  const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(`\n已写入 ${outFile}（${sizeMb} MB）`);

  const metaFile = path.join(outDir, "meta.json");
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    meta.total = clean.length;
    meta.generatedAt = new Date().toISOString();
    fs.writeFileSync(metaFile, JSON.stringify(meta), "utf8");
    console.log(`已更新 ${metaFile}：total=${meta.total}`);
  }
}

main();
