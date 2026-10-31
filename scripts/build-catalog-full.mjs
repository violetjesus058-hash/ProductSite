#!/usr/bin/env node
/**
 * 全站目录构建：以 catalog-new CSV 为唯一数据源，重建 client/public/catalog-data。
 *
 * 产物：
 *   catalog-index.json        表格页索引（13,844 行，含 fragrance）
 *   pages-60/{n}.json         首页分页（排除 fragrance，Product 形状）
 *   source-index.json         sourceProductId → 页码，供详情页懒加载同款
 *   products/{sid}.json       商品详情聚合（/product1/:id 直接读取）
 *   meta.json                 分类 / 快捷分类 / 平台清单
 *   kakobuy-catalog.csv       对外 CSV 下载
 *
 * 用法：node scripts/build-catalog-full.mjs [a.csv b.csv c.csv]
 * 默认读取仓库内 data/catalog-new.csv、-2、-3。
 */
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCatalogNewDatasets } from "./lib/catalog-new-dataset.mjs";
import { applyStyleImages } from "./lib/style-image-overlay.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "client/public/catalog-data");
const siteUrl = "https://productsite-8wf.pages.dev";
const placeholder = "/catalog-detail-stilllife.webp";
const unavailableCategories = new Set(["fragrance"]);
const PAGE_SIZE = 60;

const categoryLabels = {
  clothing: "Clothing",
  shoe: "Shoes",
  pants: "Pants",
  bags: "Bags",
  watches: "Watches",
  ACC: "Accessories",
  fragrance: "Fragrance",
};

// 与主站 meta 的平台清单一致（35 个）
const PLATFORM_NAMES = [
  "Oopbuy", "Kakobuy", "Superbuy", "RizzitGO", "ZentBuy", "LoloBuy", "PikoBuy",
  "BoonBuy", "LoongBuy", "HubbuyCN", "Joyagoo", "EastMallBuy", "Okeyhaul", "PonyBuy",
  "CSSBuy", "AnovaBuy", "MyCNBox", "iTaoBuy", "Didpop", "BBDBuy", "CnShopper", "ESGOBuy",
  "Litbuy", "GTbuy", "Hipobuy", "Fansbuy", "LoveGoBuy", "Hoobuy", "UsFans", "OrientDig",
  "Sugargoo", "BBDBuyEU", "VigorBuy", "Fishgoo", "UUFans",
];

const splitList = (value) => String(value || "").split(/[|;]/).map((entry) => entry.trim()).filter(Boolean);

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

function jsonWrite(filePath, value) {
  return fs.writeFile(filePath, JSON.stringify(value));
}

function toSummary(record) {
  const images = splitList(record.images);
  const sizes = splitList(record.sizes);
  return {
    id: String(record.id || "").trim(),
    sourceProductId: String(record.sourceProductId || "").trim(),
    name: String(record.catalogName || record.name || "").trim(),
    styleKey: String(record.styleKey || "").trim(),
    styleLabel: String(record.styleLabel || "").trim(),
    thumbnail: images[0] || "",
    category: normalizeCategory(record.category),
    subCategory: String(record.subCategory || "").trim(),
    price: Number(record.price) || 0,
    currency: String(record.currency || "USD").trim() || "USD",
    sizeCount: sizes.length,
    platformCount: PLATFORM_NAMES.length,
    primaryPlatform: "Oopbuy",
    platformKeys: PLATFORM_NAMES,
    hasStyleImage: images.length > 1,
    priceCheckedAt: String(record.priceCheckedAt || record.collectedAt || "").trim(),
  };
}

function toProduct(record) {
  const images = splitList(record.images);
  return {
    id: String(record.id || "").trim(),
    sourceProductId: String(record.sourceProductId || "").trim(),
    name: String(record.name || "").trim(),
    catalogName: String(record.catalogName || record.name || "").trim(),
    category: normalizeCategory(record.category),
    subCategory: String(record.subCategory || "").trim(),
    styleKey: String(record.styleKey || "").trim(),
    styleLabel: String(record.styleLabel || "").trim(),
    reviewStatus: String(record.reviewStatus || "unreviewed").trim() || "unreviewed",
    reviewNote: String(record.reviewNote || "").trim(),
    brand: String(record.brand || "Unbranded").trim() || "Unbranded",
    price: Number(record.price) || 0,
    referencePrice: Number(record.referencePrice) || null,
    currency: String(record.currency || "USD").trim() || "USD",
    description: String(record.description || "").trim(),
    sizes: splitList(record.sizes),
    colors: splitList(record.colors),
    stock: String(record.stock || "In stock").trim() || "In stock",
    shop: String(record.shop || "").trim(),
    shopUrl: String(record.shopUrl || "").trim(),
    url: String(record.url || "").trim(),
    images,
    tags: splitList(record.tags),
    collectedAt: String(record.collectedAt || "").trim(),
    priceCheckedAt: String(record.priceCheckedAt || record.collectedAt || "").trim(),
    sourceSkuIds: splitList(record.sourceSkuIds),
  };
}

// 同源商品的款式行轮询穿插，避免首页第一页被同一个商品占满
function interleaveBySource(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.sourceProductId || row.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const ordered = [];
  let remaining = groups.size;
  while (remaining > 0) {
    remaining = 0;
    for (const queue of groups.values()) {
      const row = queue.shift();
      if (row) ordered.push(row);
      if (queue.length) remaining += 1;
    }
  }
  return ordered;
}

async function writeCatalogCsv(rows, platformSourcesFor) {
  const header = ["category", "product_name", "style_name", "sizes", "price_usd", "agents_count", "first_agent", "product_link", "image_url", "style_id", "refreshed"];
  const absoluteUrl = (value) => (String(value || "").startsWith("/") ? `${siteUrl}${value}` : String(value || ""));
  const escapeField = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const records = rows.map((row) => {
    const sources = platformSourcesFor({ sourceProductId: row.sourceProductId, url: row.url }) || [];
    return {
      category: categoryLabels[normalizeCategory(row.category)] || row.category,
      product_name: row.name,
      style_name: row.styleLabel,
      sizes: splitList(row.sizes).join(", "),
      price_usd: Number.isFinite(Number(row.price)) ? Number(row.price).toFixed(2) : "",
      agents_count: sources.length,
      first_agent: sources[0]?.name || "Oopbuy",
      product_link: /kakobuy\.com/i.test(row.url || "")
        ? row.url
        : `https://www.kakobuy.com/item/details?url=${encodeURIComponent(`https://weidian.com/item.html?itemID=${row.sourceProductId}`)}&affcode=vxxss`,
      image_url: absoluteUrl(splitList(row.images)[0] || placeholder),
      style_id: row.id,
      refreshed: String(row.priceCheckedAt || "").slice(0, 10),
    };
  });
  records.sort((left, right) => left.category.localeCompare(right.category) || left.product_name.localeCompare(right.product_name) || left.style_id.localeCompare(right.style_id));

  const errors = [];
  const seen = new Set();
  records.forEach((record, index) => {
    if (!record.style_id) errors.push(`第 ${index + 2} 行 style_id 为空`);
    else if (seen.has(record.style_id)) errors.push(`style_id 重复：${record.style_id}`);
    seen.add(record.style_id);
    for (const key of ["category", "product_name", "price_usd", "agents_count", "first_agent", "product_link", "image_url", "style_id", "refreshed"]) {
      if (!String(record[key] ?? "").trim()) errors.push(`${record.style_id || index}: ${key} 为空`);
    }
    const price = Number(record.price_usd);
    if (!(price >= 1.07 && price <= 192.65)) errors.push(`${record.style_id}: price_usd 越界 ${record.price_usd}`);
    const agents = Number(record.agents_count);
    if (!Number.isInteger(agents) || agents < 1 || agents > 35) errors.push(`${record.style_id}: agents_count 越界 ${record.agents_count}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.refreshed)) errors.push(`${record.style_id}: refreshed 非 YYYY-MM-DD`);
    if (!/^https:\/\//.test(record.product_link)) errors.push(`${record.style_id}: product_link 非 https`);
    if (!/^https:\/\//.test(record.image_url)) errors.push(`${record.style_id}: image_url 非 https`);
  });
  if (errors.length) throw new Error(`kakobuy-catalog.csv 校验失败：\n${errors.slice(0, 20).join("\n")}`);

  const body = [header, ...records.map((record) => header.map((key) => record[key]))]
    .map((cells) => cells.map(escapeField).join(","))
    .join("\r\n");
  const content = `\ufeff${body}\r\n`;
  await fs.writeFile(path.join(root, "client/public/kakobuy-catalog.csv"), content, "utf8");
  console.log(`  CSV           : ${records.length} 行, ${(Buffer.byteLength(content) / 1024 / 1024).toFixed(2)}MB`);
}

async function main() {
  const csvArgs = process.argv.slice(2).filter((value) => /\.csv$/i.test(value));
  const defaultCsvs = ["catalog-new.csv", "catalog-new-2.csv", "catalog-new-3.csv"]
    .map((name) => path.join(root, "data", name))
    .filter((file) => existsSync(file));
  const csvPaths = (csvArgs.length ? csvArgs.map((value) => path.resolve(value)) : defaultCsvs);
  if (!csvPaths.length) throw new Error("找不到 CSV：请把 catalog-new*.csv 放在 data/ 下，或用参数指定");

  const { rows: allRecords, stats } = readCatalogNewDatasets(csvPaths);
  applyStyleImages(allRecords);
  console.log(`CSV 行数      : ${allRecords.length}（${csvPaths.length} 批，商品 ${new Set(allRecords.map((row) => row.sourceProductId)).size} 个）`);

  const summaries = allRecords.map(toSummary).filter((item) => item.id && item.name);
  const pageRows = allRecords.filter((row) => !unavailableCategories.has(normalizeCategory(row.category)));
  const products = pageRows.map(toProduct);

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });

  // 1. 表格索引
  await jsonWrite(path.join(outputRoot, "catalog-index.json"), summaries);

  // 2. 首页分页
  const ordered = interleaveBySource(products);
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const pagesDir = path.join(outputRoot, `pages-${PAGE_SIZE}`);
  await fs.mkdir(pagesDir, { recursive: true });
  for (let page = 1; page <= totalPages; page += 1) {
    await jsonWrite(path.join(pagesDir, `${page}.json`), {
      page,
      pageSize: PAGE_SIZE,
      total: ordered.length,
      totalPages,
      items: ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    });
  }

  // 3. source → pages 映射
  const sourceIndex = {};
  for (let page = 1; page <= totalPages; page += 1) {
    const slice = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const seenInPage = new Set();
    for (const product of slice) {
      const sid = product.sourceProductId || product.id;
      if (!sid || seenInPage.has(sid)) continue;
      seenInPage.add(sid);
      if (!sourceIndex[sid]) sourceIndex[sid] = [];
      sourceIndex[sid].push(page);
    }
  }
  await jsonWrite(path.join(outputRoot, "source-index.json"), sourceIndex);

  // 4. 商品详情聚合（/product1/:id）
  const detailGroups = new Map();
  for (const row of allRecords) {
    const sid = row.sourceProductId || row.id;
    if (!sid) continue;
    if (!detailGroups.has(sid)) detailGroups.set(sid, []);
    detailGroups.get(sid).push(row);
  }
  const productsDir = path.join(outputRoot, "products");
  await fs.mkdir(productsDir, { recursive: true });
  for (const [sid, groupRows] of [...detailGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
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
    await jsonWrite(path.join(productsDir, `${sid}.json`), {
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
    });
  }

  // 5. meta（平台、分类、快捷分类）
  const platformMap = new Map();
  for (const row of summaries) for (const key of row.platformKeys) platformMap.set(key.toLowerCase(), { key, label: key });
  const categoryKeys = Object.keys(categoryLabels).filter((key) => summaries.some((row) => row.category === key));
  const quickDefs = [
    { key: "shoe", label: "Shoes" },
    { key: "long-sleeve", label: "Long sleeve" },
    { key: "pants", label: "Pants" },
    { key: "clothing", label: "Clothing" },
    { key: "ACC", label: "Accessories" },
    { key: "bags", label: "Bags" },
    { key: "watches", label: "Watches" },
    { key: "fragrance", label: "Fragrance" },
  ];
  const quickCategories = quickDefs.map((definition) => {
    const row = definition.key === "long-sleeve"
      ? summaries.find((item) => /long\s*sleeve/i.test(item.subCategory || item.name || ""))
      : summaries.find((item) => item.category === definition.key);
    return { key: definition.key, label: definition.label, thumbnail: row?.thumbnail || placeholder };
  });
  await jsonWrite(path.join(outputRoot, "meta.json"), {
    total: products.length,
    generatedAt: new Date().toISOString(),
    pageSizes: [20, 50],
    categories: categoryKeys.filter((key) => !unavailableCategories.has(key)).map((key) => ({ key, label: categoryLabels[key] })),
    quickCategories,
    platforms: [...platformMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  });

  // 6. 对外 CSV
  const { platformSourcesFor } = await import(pathToFileURL(path.join(root, "client/src/lib/platformSources.mjs")).href);
  await writeCatalogCsv(pageRows, platformSourcesFor);

  console.log(`首页分页      : ${totalPages} 页 / ${products.length} 行（排除 fragrance ${allRecords.length - pageRows.length} 行）`);
  console.log(`商品详情      : ${detailGroups.size} 个 JSON`);
  console.log(`表格索引      : ${summaries.length} 行`);
  console.log(`生成目录      : ${path.relative(root, outputRoot)}`);
  console.log(`对齐统计      : new link 重定向 ${stats.rekeyedProducts} 个商品，链尾去重 ${stats.dedupedRows} 行，跨批重复 ${stats.crossFileDuplicates} 行`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
