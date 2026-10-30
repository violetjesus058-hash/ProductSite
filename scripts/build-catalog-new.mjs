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
import { readCatalogNewDatasets } from "./lib/catalog-new-dataset.mjs";

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
  // 支持多批 CSV：所有 .csv 参数按顺序汇总，其余参数视作输出目录
  const csvArgs = positional.filter((a) => /\.csv$/i.test(a));
  const csvPaths = (csvArgs.length ? csvArgs : ["D:\\ps\\catalog-new.csv"]).map((value) => path.resolve(value));
  const outArg = positional.find((a) => !/\.csv$/i.test(a)) || "client/public/catalog-data-1";
  const verifyOnly = flags.includes("--inspect");

  for (const csvPath of csvPaths) {
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV 不存在：${csvPath}`);
      process.exit(1);
    }
  }

  const { rows: records, stats } = readCatalogNewDatasets(csvPaths);
  const summaries = records.map(toSummary).filter((item) => item.id && item.name);
  const dropped = records.length - summaries.length;

  const categoryCount = {};
  const platformSet = new Set();
  for (const item of summaries) {
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    for (const key of item.platformKeys) platformSet.add(key);
  }

  console.log(`CSV 文件      : ${csvPaths.map((csvPath) => path.basename(csvPath)).join(" + ")}`);
  console.log(`CSV 行数      : ${stats.rowsIn}`);
  console.log(`id 对齐       : ${stats.rekeyedProducts} 个商品换用 new link id（${stats.productsIn} → ${stats.productsOut} 个商品）`);
  console.log(`链尾合并      : ${stats.mergedTargets.join(", ") || "无"}（去重 ${stats.dedupedRows} 行重复款式）`);
  console.log(`跨批重复      : 丢弃 ${stats.crossFileDuplicates} 行后一批的重复款式`);
  console.log(`空 new link   : ${stats.emptyNewLinkProducts.length} 个商品保持原 id`);
  if (stats.splitOff.length) {
    const groups = [...new Set(stats.splitOff.map((item) => `${item.target}(保留 ${item.keptCategory}，${item.category} 的 ${item.oldId} 回退旧 id)`))];
    console.log(`合并拆分      : ${groups.join("；")}`);
  }
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
