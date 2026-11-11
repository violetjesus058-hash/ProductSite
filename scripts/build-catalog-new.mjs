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
import { parseCsvRows, readCatalogNewDatasets } from "./lib/catalog-new-dataset.mjs";
import { applyStyleImages } from "./lib/style-image-overlay.mjs";

// 与主站 catalog-data 的平台清单保持一致（35 个），否则 /spreadsheet1 的 platform 参数会因
// 找不到对应 key 被前端静默重置成「All platforms」，表现为主站能筛、spreadsheet1 筛不动。
const PLATFORM_NAMES = [
  "Oopbuy", "Kakobuy", "Superbuy", "RizzitGO", "ZentBuy", "LoloBuy", "PikoBuy",
  "BoonBuy", "LoongBuy", "HubbuyCN", "Joyagoo", "EastMallBuy", "Okeyhaul", "PonyBuy",
  "CSSBuy", "AnovaBuy", "MyCNBox", "iTaoBuy", "Didpop", "BBDBuy", "CnShopper", "ESGOBuy",
  "Litbuy", "GTbuy", "Hipobuy", "Fansbuy", "LoveGoBuy", "Hoobuy", "UsFans", "OrientDig",
  "Sugargoo", "BBDBuyEU", "VigorBuy", "Fishgoo", "UUFans",
];
const HIDDEN_PLATFORMS = new Set(["acbuy", "allchinabuy", "mulebuy"]);

const CATEGORY_MAP = {
  clothing: "clothing", clothes: "clothing", tops: "clothing", top: "clothing",
  pants: "pants", pant: "pants", trousers: "pants",
  shoe: "shoe", shoes: "shoe", sneakers: "shoe",
  bags: "bags", bag: "bags",
  watches: "watches", watch: "watches",
  acc: "ACC", accessories: "ACC", accessory: "ACC",
  lego: "lego", blocks: "lego", buildingblocks: "lego", brick: "lego", bricks: "lego",
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

const UNBRANDED = "Unbranded";

function normalizeBrandToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  // 「子路潮品」是货源/店铺词，按需求统一归入无品牌。
  if (text === "子路潮品" || /^(无|无品牌|none|unknown|n\/a)$/i.test(text)) return UNBRANDED;
  return text;
}

// 品牌 CSV 是人工核验导出，商品 id 仍是批量替换前的旧 id；用构建时已有的
// oldId → targetId 映射对齐到 /spreadsheet1 的 sourceProductId。
function loadBrandMap(file, idMap, targetIds) {
  if (!fs.existsSync(file)) {
    console.warn(`品牌数据    : 未找到 ${file}，跳过品牌字段`);
    return null;
  }
  const table = parseCsvRows(fs.readFileSync(file, "utf8").replace(/^\ufeff/, ""));
  if (!table.length) return null;
  const header = table.shift().map((value) => value.trim());
  const map = new Map();
  let matchedRows = 0;
  for (const values of table) {
    const row = {};
    header.forEach((key, index) => { row[key] = String(values[index] ?? "").trim(); });
    const ids = [row["商品ID"], ...String(row["关联商品ID"] || "").split(/[;|]/).map((value) => value.trim())].filter(Boolean);
    const targets = new Set();
    for (const id of ids) {
      const target = idMap.get(id) || id;
      if (targetIds.has(target)) targets.add(target);
    }
    if (!targets.size) continue;
    matchedRows += 1;
    const tokens = [];
    for (const value of String(row["品牌"] || "").split(/[;/]/)) {
      const token = normalizeBrandToken(value);
      if (token && !tokens.includes(token)) tokens.push(token);
    }
    for (const target of targets) {
      if (!map.has(target)) map.set(target, []);
      const brands = map.get(target);
      for (const token of tokens) if (!brands.includes(token)) brands.push(token);
    }
  }
  console.log(`品牌数据    : ${matchedRows}/${table.length} 行匹配，覆盖 ${map.size} 个商品`);
  return map;
}

// 平台清单一旦和主站漂移，前端会把 URL 里的 platform 静默重置成「All platforms」，
// 表现为同一平台在主站能筛、在 /spreadsheet1 筛不动，所以构建前先做对齐校验。
function assertPlatformsAligned() {
  const mainMetaFile = path.resolve("client/public/catalog-data/meta.json");
  if (!fs.existsSync(mainMetaFile)) {
    throw new Error(`找不到主站平台清单 ${mainMetaFile}，请在 D:\\ps\\ProductSite 目录下执行构建`);
  }
  const mainMeta = JSON.parse(fs.readFileSync(mainMetaFile, "utf8"));
  const norm = (key) => String(key || "").trim().toLowerCase();
  const mainKeys = (mainMeta.platforms || [])
    .map((platform) => platform.key)
    .filter((key) => !HIDDEN_PLATFORMS.has(norm(key)));
  const mainSet = new Set(mainKeys.map(norm));
  const localSet = new Set(PLATFORM_NAMES.map(norm));
  const missing = mainKeys.filter((key) => !localSet.has(norm(key)));
  const extra = PLATFORM_NAMES.filter((key) => !mainSet.has(norm(key)));
  if (missing.length || extra.length) {
    throw new Error([
      "平台清单与主站不一致，已中止构建。",
      `  主站有、本脚本缺：${missing.join(", ") || "无"}`,
      `  本脚本有、主站缺：${extra.join(", ") || "无"}`,
      "  请先同步 scripts/build-catalog-new.mjs 的 PLATFORM_NAMES。",
    ].join("\n"));
  }
  console.log(`平台校验      : 与主站一致（${mainKeys.length} 个）`);
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

  assertPlatformsAligned();

  for (const csvPath of csvPaths) {
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV 不存在：${csvPath}`);
      process.exit(1);
    }
  }

  const { rows: records, stats } = readCatalogNewDatasets(csvPaths, { mergeLinkTargets: true });
  const overlay = applyStyleImages(records);
  const summaries = records.map(toSummary).filter((item) => item.id && item.name);
  const dropped = records.length - summaries.length;

  // /spreadsheet1 专属品牌字段：品牌 CSV 的旧 id 先对齐到当前 sourceProductId。
  const targetIds = new Set(summaries.map((item) => item.sourceProductId));
  const brandMap = loadBrandMap(path.resolve("data/brand-audit.csv"), stats.idMap || new Map(), targetIds);
  if (brandMap) {
    for (const item of summaries) {
      const brands = brandMap.get(item.sourceProductId) || [];
      item.brand = brands[0] || UNBRANDED;
      item.brands = brands.length ? brands : [UNBRANDED];
    }
  }

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
  const mainMetaFile = path.resolve("client/public/catalog-data/meta.json");
  const metaSource = fs.existsSync(metaFile) ? metaFile : fs.existsSync(mainMetaFile) ? mainMetaFile : "";
  if (metaSource) {
    const meta = JSON.parse(fs.readFileSync(metaSource, "utf8"));
    meta.total = clean.length;
    meta.generatedAt = new Date().toISOString();
    if (brandMap) {
      const brandCounts = new Map();
      const seenProducts = new Set();
      for (const item of summaries) {
        if (seenProducts.has(item.sourceProductId)) continue;
        seenProducts.add(item.sourceProductId);
        for (const brand of item.brands) brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
      }
      meta.brands = [...brandCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, count]) => ({ key, label: key, count }));
      console.log(`品牌清单    : ${meta.brands.length} 个（${meta.brands.slice(0, 5).map((item) => `${item.label} ${item.count}`).join(", ")}…）`);
    } else {
      delete meta.brands;
    }
    fs.writeFileSync(metaFile, JSON.stringify(meta), "utf8");
    console.log(`已更新 ${metaFile}：total=${meta.total}`);
  }

  // 商品详情聚合（/product1/:id 直接读取），与主站 catalog-data/products 结构保持一致，
  // 保证隔离路径的详情页只使用 catalog-data-1，不依赖主站数据集。
  const detailGroups = new Map();
  for (const row of records) {
    const sid = String(row.sourceProductId || row.id || "").trim();
    if (!sid) continue;
    if (!detailGroups.has(sid)) detailGroups.set(sid, []);
    detailGroups.get(sid).push(row);
  }
  const productsDir = path.join(outDir, "products");
  fs.mkdirSync(productsDir, { recursive: true });
  let detailCount = 0;
  for (const [sid, groupRows] of detailGroups) {
    const first = groupRows[0];
    const gallery = [];
    const styles = groupRows.map((row) => {
      const images = splitList(row.images);
      for (const image of images) if (!gallery.includes(image)) gallery.push(image);
      return {
        id: row.id,
        styleKey: row.styleKey,
        styleLabel: row.styleLabel,
        price: Number(row.price) || 0,
        currency: row.currency || "USD",
        sizes: splitList(row.sizes),
        colors: splitList(row.colors),
        stock: row.stock,
        images,
        description: row.description,
      };
    });
    fs.writeFileSync(path.join(productsDir, `${sid}.json`), JSON.stringify({
      sourceProductId: sid,
      name: first.name,
      catalogName: first.catalogName,
      brand: first.brand,
      category: first.category,
      subCategory: first.subCategory,
      shopUrl: first.shopUrl,
      productUrl: first.url,
      refreshed: String(first.priceCheckedAt || "").slice(0, 10),
      gallery,
      styles,
    }), "utf8");
    detailCount += 1;
  }
  console.log(`详情文件      : ${detailCount} 个 products/*.json`);
}

main();
