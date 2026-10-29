import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productSourcePath = path.join(root, "client/src/data/products.ts");
const styleImageSourcePath = path.join(root, "client/src/data/style-images.ts");
const outputRoot = path.join(root, "client/public/catalog-data");
const productChunksDir = path.join(outputRoot, "products");
const previewDir = path.join(outputRoot, "previews");
const pageSizes = [20, 50];
// Keep the first catalog batch small enough for a fast initial route, then let the
// browser load the remaining batches in the background.
const maxProductChunkBytes = 1 * 1024 * 1024;
const placeholder = "/catalog-detail-stilllife.webp";
const categoryLabels = {
  clothing: "Clothing",
  shoe: "Shoes",
  pants: "Pants",
  bags: "Bags",
  watches: "Watches",
  ACC: "Accessories",
};
const categoryOrder = ["clothing", "pants", "shoe", "bags", "watches", "ACC"];
const unavailableCategoryKeys = new Set(["fragrance"]);
// 需求 FR-05：14,535 与六分类计数是校验基线，数据更新时须同步修改这里与页面文案，
// 不得通过放宽校验让构建通过。
const EXPECTED_STYLE_ROWS = 14535;
// agents_count 统计的是「该行可采购链接数」，与站点 34 个 agent 索引规模不是同一个量。
// 35 是静态上限，唯一例外商品 7543342819（39 行，额外 12 个平台映射 + UUFans QC 深链）。
// 不要改成动态推断，否则未来数据异常时会自动放宽校验。
const EXPECTED_MAX_AGENTS = 35;
const EXPECTED_CATEGORY_COUNTS = {
  Clothing: 7623,
  Accessories: 2919,
  Shoes: 1852,
  Pants: 1594,
  Bags: 283,
  Watches: 264,
};

function readJsStringLiteral(source, start) {
  while (/\s/.test(source[start] || "")) start += 1;
  const quote = source[start];
  if (quote !== "\"" && quote !== "'") throw new Error("Expected a JSON.parse string literal in product source.");
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) {
      const literal = source.slice(start, index + 1);
      return { literal, end: index + 1 };
    }
  }
  throw new Error("Unterminated JSON.parse string in product source.");
}

function matchingBraceEnd(source, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index + 1;
  }
  throw new Error("Unterminated object in style image source.");
}

async function loadProducts() {
  const source = await fs.readFile(productSourcePath, "utf8");
  const parseAt = source.indexOf("JSON.parse(");
  if (parseAt < 0) throw new Error(`Could not find JSON.parse in ${productSourcePath}`);
  const { literal } = readJsStringLiteral(source, parseAt + "JSON.parse(".length);
  const jsonText = vm.runInNewContext(literal, Object.create(null), { timeout: 30_000 });
  const products = JSON.parse(jsonText);
  if (!Array.isArray(products) || products.length === 0) throw new Error("Product source parsed to an empty catalog.");
  return products;
}

async function loadStyleImages() {
  const source = await fs.readFile(styleImageSourcePath, "utf8");
  const assignmentAt = source.indexOf("styleImages");
  const objectStart = source.indexOf("{", assignmentAt);
  if (assignmentAt < 0 || objectStart < 0) return {};
  const objectEnd = matchingBraceEnd(source, objectStart);
  return vm.runInNewContext(`(${source.slice(objectStart, objectEnd)})`, Object.create(null), { timeout: 30_000 });
}

function safeSourceId(product) {
  return String(product.sourceProductId || product.id || "");
}

function styleKeyFor(product) {
  if (product.styleKey) return String(product.styleKey).toLowerCase();
  const candidate = (product.sizes || []).find((value) => /[;:|]/.test(value));
  return candidate?.split(/[;:|]/)[0].trim().toLowerCase() || "";
}

function styleImageFor(product, styleImages) {
  const sourceId = safeSourceId(product);
  const options = styleImages[sourceId] || {};
  const key = styleKeyFor(product);
  const exact = product.styleKey || key;
  const image = options[exact] || options[key] || Object.entries(options).find(([candidate]) => candidate.toLowerCase() === key)?.[1];
  return image || product.images?.[0] || placeholder;
}

function jsonWrite(filePath, value) {
  return fs.writeFile(filePath, JSON.stringify(value));
}

const affiliateParamPattern = /^(affcode|aff_code|invitecode|invite_code|utm_|source_?tag|share_?id)/i;

function stripAffiliateParams(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }
  let changed = false;
  for (const key of [...parsed.searchParams.keys()]) {
    if (affiliateParamPattern.test(key)) {
      parsed.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? parsed.toString() : value;
}

/**
 * 需求 §5：product_link 必须是商品实际来源的原链，且不得带 affcode 等联盟参数。
 * 数据源里的 url 是 Kakobuy 联盟链，真实来源编码在它的 url 参数内，
 * 因此优先解出该参数；解不出可用链接时退回由 sourceProductId 拼出的 Weidian 原链。
 */
function sourceProductLink(product, sourceProductId) {
  const raw = String(product?.url || "");
  let embedded = "";
  try {
    embedded = new URL(raw).searchParams.get("url") || "";
  } catch {
    embedded = "";
  }
  if (embedded) {
    try {
      const decoded = decodeURIComponent(embedded);
      const cleaned = stripAffiliateParams(decoded);
      if (/^https:\/\//.test(cleaned)) return cleaned;
    } catch {
      // 解码失败时继续走 sourceProductId 兜底
    }
  }
  if (sourceProductId) return `https://weidian.com/item.html?itemID=${encodeURIComponent(sourceProductId)}`;
  return "";
}

function curatedPriority(product, isLongSleeve) {
  const category = String(product.category || "").trim().toLowerCase();
  if (category === "shoe") return 0;
  if (isLongSleeve(product)) return 1;
  if (category === "pants") return 2;
  return 3;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableShuffle(items, seed) {
  return [...items].sort((a, b) => stableHash(`${seed}:${a.key}`) - stableHash(`${seed}:${b.key}`));
}

/**
 * Interleave categories and source-product groups so styles from one product
 * are not rendered as a consecutive block. The fixed hash keeps the order
 * stable between builds while still giving the catalog a mixed, editorial feel.
 */
function interleaveProducts(products) {
  const byCategory = new Map();
  for (const product of products) {
    const category = String(product.category || "other");
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const groups = byCategory.get(category);
    const sourceId = String(product.sourceProductId || product.id || "");
    if (!groups.has(sourceId)) groups.set(sourceId, []);
    groups.get(sourceId).push(product);
  }

  const categories = stableShuffle(
    [...byCategory.entries()].map(([key, groups]) => ({ key, groups })),
    "categories",
  );
  const states = categories.map(({ key, groups }) => ({
    key,
    groups: stableShuffle(
      [...groups.entries()].map(([groupKey, items]) => ({ key: groupKey, items: stableShuffle(items.map((item) => ({ key: String(item.id), item })), `${key}:styles`).map(({ item }) => item) })),
      `${key}:products`,
    ),
    groupIndex: 0,
  }));
  const output = [];
  let remaining = states.length;

  while (remaining > 0) {
    remaining = 0;
    for (const state of states) {
      let selected;
      for (let offset = 0; offset < state.groups.length; offset += 1) {
        const index = (state.groupIndex + offset) % state.groups.length;
        if (state.groups[index].items.length > 0) {
          selected = state.groups[index];
          state.groupIndex = (index + 1) % state.groups.length;
          break;
        }
      }
      if (selected) {
        output.push(selected.items.shift());
        remaining += 1;
      }
    }
  }
  return output;
}

async function writeProductChunks(products) {
  await fs.rm(productChunksDir, { recursive: true, force: true });
  await fs.mkdir(productChunksDir, { recursive: true });
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  for (const product of products) {
    const serialized = JSON.stringify(product);
    const bytes = Buffer.byteLength(serialized) + (current.length ? 1 : 0);
    if (current.length && currentBytes + bytes > maxProductChunkBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(product);
    currentBytes += bytes;
  }
  if (current.length) chunks.push(current);
  let largestChunkBytes = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const name = `chunk-${String(index + 1).padStart(3, "0")}.json`;
    const filePath = path.join(productChunksDir, name);
    await jsonWrite(filePath, chunks[index]);
    largestChunkBytes = Math.max(largestChunkBytes, (await fs.stat(filePath)).size);
  }
  await jsonWrite(path.join(productChunksDir, "manifest.json"), {
    total: products.length,
    chunks: chunks.map((_, index) => `chunk-${String(index + 1).padStart(3, "0")}.json`),
    generatedAt: new Date().toISOString(),
  });
  return { count: chunks.length, largestChunkBytes };
}

async function writeCatalogPages(products, pageSize = 60) {
  const directory = path.join(outputRoot, `pages-${pageSize}`);
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  for (let page = 1; page <= totalPages; page += 1) {
    const start = (page - 1) * pageSize;
    await jsonWrite(path.join(directory, `${page}.json`), {
      page,
      pageSize,
      total: products.length,
      totalPages,
      items: products.slice(start, start + pageSize),
    });
  }
  return totalPages;
}

async function main() {
  const [{ platformSourcesFor, primarySourceFor }, { isLongSleeve }] = await Promise.all([
    import(pathToFileURL(path.join(root, "client/src/lib/platformSources.mjs")).href),
    import(pathToFileURL(path.join(root, "client/src/lib/catalogOrdering.mjs")).href),
  ]);
  const [allProducts, styleImages] = await Promise.all([loadProducts(), loadStyleImages()]);
  const products = allProducts.filter((product) => !unavailableCategoryKeys.has(String(product.category || "").trim().toLowerCase()));
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.rm(previewDir, { recursive: true, force: true });
  await fs.mkdir(previewDir, { recursive: true });

  const rows = products.map((product) => {
    const platforms = platformSourcesFor(product);
    const primary = primarySourceFor(product);
    const styleKey = styleKeyFor(product);
    const styleImage = styleImageFor(product, styleImages);
    return {
      id: String(product.id),
      sourceProductId: safeSourceId(product),
      name: String(product.catalogName || product.name || "Catalog item"),
      styleKey,
      styleLabel: String(product.styleLabel || ""),
      thumbnail: styleImage,
      category: String(product.category || ""),
      subCategory: String(product.subCategory || ""),
      price: Number(product.price) || 0,
      currency: String(product.currency || "USD"),
      sizeCount: Array.isArray(product.sizes) ? product.sizes.length : 0,
      platformCount: platforms.length,
      primaryPlatform: primary?.name || platforms[0]?.name || "",
      platformKeys: platforms.map((platform) => platform.name),
      hasStyleImage: styleImage !== (product.images?.[0] || placeholder),
      priceCheckedAt: String(product.priceCheckedAt || product.collectedAt || ""),
    };
  });

  const csvPath = path.join(root, "client/public/kakobuy-catalog.csv");
  const writeCatalogCsv = async () => {
    const header = ["category", "product_name", "style_name", "sizes", "price_usd", "agents_count", "first_agent", "product_link", "image_url", "style_id", "refreshed"];
    const absoluteUrl = (value) => {
      const text = String(value || "");
      return text.startsWith("/") ? `https://productsite-8wf.pages.dev${text}` : text;
    };
    const escapeField = (value) => {
      const text = String(value ?? "");
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const sizeText = (sizes) => {
      if (!Array.isArray(sizes)) return "";
      return sizes
        .map((value) => String(value).trim())
        .filter((value) => value && !/^(0|n\/a|na|none|null|-)$/i.test(value))
        .join(", ");
    };
    const records = rows.map((row, index) => {
      const product = products[index];
      const priceValue = Number(product.price);
      return {
        category: categoryLabels[row.category] || row.category,
        product_name: row.name,
        style_name: row.styleLabel,
        sizes: sizeText(product.sizes),
        // 需求 §5：缺失或非数字价格必须判失败，不得以 0.00 兜底
        price_usd: Number.isFinite(priceValue) ? priceValue.toFixed(2) : "",
        agents_count: row.platformCount,
        first_agent: row.primaryPlatform,
        product_link: sourceProductLink(product, row.sourceProductId),
        image_url: absoluteUrl(row.thumbnail),
        style_id: row.id,
        refreshed: String(row.priceCheckedAt || "").slice(0, 10),
      };
    });
    records.sort((left, right) => left.category.localeCompare(right.category) || left.product_name.localeCompare(right.product_name) || left.style_id.localeCompare(right.style_id));

    const errors = [];
    if (records.length !== EXPECTED_STYLE_ROWS) errors.push(`行数 ${records.length}，期望 ${EXPECTED_STYLE_ROWS}`);
    const seen = new Set();
    const counts = {};
    const badRows = [];
    for (const record of records) {
      if (!record.style_id) errors.push("style_id 为空");
      else if (seen.has(record.style_id)) errors.push(`style_id 重复：${record.style_id}`);
      seen.add(record.style_id);
      counts[record.category] = (counts[record.category] || 0) + 1;
      const issues = [];
      // sizes 与 style_name 按需求允许为空，仅校验其余必填列
      for (const key of ["category", "product_name", "price_usd", "agents_count", "first_agent", "product_link", "image_url", "style_id", "refreshed"]) {
        if (!String(record[key] ?? "").trim()) issues.push(`${key} 为空`);
      }
      const price = Number(record.price_usd);
      if (record.price_usd && !(price >= 1.07 && price <= 192.65)) issues.push(`price_usd 越界 ${record.price_usd}`);
      const agents = Number(record.agents_count);
      if (!Number.isInteger(agents) || agents < 1 || agents > EXPECTED_MAX_AGENTS) issues.push(`agents_count 越界 ${record.agents_count}`);
      if (record.refreshed && !/^\d{4}-\d{2}-\d{2}$/.test(record.refreshed)) issues.push(`refreshed 非 YYYY-MM-DD：${record.refreshed}`);
      if (record.product_link && !/^https:\/\//.test(record.product_link)) issues.push("product_link 非 https");
      if (record.image_url && !/^https:\/\//.test(record.image_url)) issues.push("image_url 非 https");
      if (issues.length) badRows.push(`${record.style_id || "(no style_id)"}: ${issues.join("; ")}`);
    }
    for (const [label, expected] of Object.entries(EXPECTED_CATEGORY_COUNTS)) {
      if ((counts[label] || 0) !== expected) errors.push(`分类 ${label} 行数 ${counts[label] || 0}，期望 ${expected}`);
    }
    if (badRows.length) errors.push(`字段问题 ${badRows.length} 行，前 10 条：\n${badRows.slice(0, 10).join("\n")}`);
    if (errors.length) throw new Error(`kakobuy-catalog.csv 校验失败：\n${errors.join("\n")}`);

    const body = [header, ...records.map((record) => header.map((key) => record[key]))]
      .map((cells) => cells.map(escapeField).join(","))
      .join("\r\n");
    const content = `\ufeff${body}\r\n`;
    await fs.writeFile(csvPath, content, "utf8");
    const sizeMb = Buffer.byteLength(content, "utf8") / 1024 / 1024;
    if (sizeMb > 10) console.warn(`  WARN kakobuy-catalog.csv 体积 ${sizeMb.toFixed(2)}MB，超过 10MB 阈值`);
    console.log(`  CSV ${records.length} 行, ${sizeMb.toFixed(2)}MB -> ${path.relative(root, csvPath)}`);
    return counts;
  };

  const grouped = new Map();
  for (const product of products) {
    const sourceProductId = safeSourceId(product);
    if (!grouped.has(sourceProductId)) grouped.set(sourceProductId, []);
    grouped.get(sourceProductId).push(product);
  }
  for (const [sourceProductId, group] of grouped) {
    const platforms = platformSourcesFor(group[0]);
    const preview = {
      sourceProductId,
      name: String(group[0].catalogName || group[0].name || "Catalog item"),
      platforms,
      styles: group.map((product) => ({
        id: String(product.id),
        styleKey: String(product.styleKey || styleKeyFor(product)),
        styleLabel: String(product.styleLabel || ""),
        image: styleImageFor(product, styleImages),
        price: Number(product.price) || 0,
        currency: String(product.currency || "USD"),
      })),
    };
    await jsonWrite(path.join(previewDir, `${encodeURIComponent(sourceProductId)}.json`), preview);
  }

  const categoryKeys = categoryOrder.filter((key) => products.some((product) => product.category === key));
  const categories = categoryKeys.map((key) => ({ key, label: categoryLabels[key] || key }));
  const platformMap = new Map();
  for (const row of rows) for (const key of row.platformKeys) {
    const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm && !platformMap.has(norm)) platformMap.set(norm, { key, label: key });
  }
  const quickCategoryDefs = [
    { key: "shoe", label: "Shoes", matches: (product) => product.category === "shoe" },
    { key: "long-sleeve", label: "Long sleeve", matches: isLongSleeve },
    { key: "pants", label: "Pants", matches: (product) => product.category === "pants" },
    { key: "clothing", label: "Clothing", matches: (product) => product.category === "clothing" },
    { key: "ACC", label: "Accessories", matches: (product) => product.category === "ACC" },
    { key: "bags", label: "Bags", matches: (product) => product.category === "bags" },
    { key: "watches", label: "Watches", matches: (product) => product.category === "watches" },
  ];
  const quickCategories = quickCategoryDefs.map((definition) => {
    const product = products.find(definition.matches);
    const row = product ? rows.find((candidate) => candidate.id === String(product.id)) : undefined;
    return { key: definition.key, label: definition.label, thumbnail: row?.thumbnail || placeholder };
  });
  const generatedAt = new Date().toISOString();
  await jsonWrite(path.join(outputRoot, "meta.json"), {
    total: products.length,
    generatedAt,
    pageSizes,
    categories,
    quickCategories,
    platforms: [...platformMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  });
  await jsonWrite(path.join(outputRoot, "catalog-index.json"), rows);
  const csvCounts = await writeCatalogCsv();
  console.log(`  CSV categories: ${JSON.stringify(csvCounts)}`);

  const priorityById = new Map(products.map((product) => [
    String(product.id), curatedPriority(product, isLongSleeve),
  ]));
  const curatedRows = [...rows].sort((a, b) =>
    (priorityById.get(a.id) || 0) - (priorityById.get(b.id) || 0) || a.id.localeCompare(b.id),
  );
  for (const pageSize of pageSizes) {
    const directory = path.join(outputRoot, `pages-${pageSize}`);
    await fs.rm(directory, { recursive: true, force: true });
    await fs.mkdir(directory, { recursive: true });
    const totalPages = Math.max(1, Math.ceil(curatedRows.length / pageSize));
    for (let page = 1; page <= totalPages; page += 1) {
      const start = (page - 1) * pageSize;
      await jsonWrite(path.join(directory, `${page}.json`), {
        page,
        pageSize,
        total: curatedRows.length,
        totalPages,
        items: curatedRows.slice(start, start + pageSize),
      });
    }
  }

  const orderedProducts = interleaveProducts(products);
  await writeCatalogPages(orderedProducts, 60);
  // Build sourceProductId → page numbers index for runtime lazy-load of sibling variants.
  const pageSizeForSourceIndex = 60;
  const sourceToPages = new Map();
  for (let page = 1; page <= Math.max(1, Math.ceil(orderedProducts.length / pageSizeForSourceIndex)); page += 1) {
    const slice = orderedProducts.slice((page - 1) * pageSizeForSourceIndex, page * pageSizeForSourceIndex);
    const seenInPage = new Set();
    for (const product of slice) {
      const sid = safeSourceId(product);
      if (!sid) continue;
      if (seenInPage.has(sid)) continue;
      seenInPage.add(sid);
      const list = sourceToPages.get(sid) || [];
      list.push(page);
      sourceToPages.set(sid, list);
    }
  }
  const sourceIndex = {};
  for (const [sid, pages] of sourceToPages.entries()) sourceIndex[sid] = pages;
  await jsonWrite(path.join(outputRoot, "source-index.json"), sourceIndex);
  const productChunkStats = await writeProductChunks(orderedProducts);
  const fileCount = (await fs.readdir(previewDir)).length;
  console.log(`Generated ${products.length.toLocaleString()} product records, ${fileCount.toLocaleString()} purchase previews, ${productChunkStats.count} product chunks (largest ${productChunkStats.largestChunkBytes.toLocaleString()} bytes), ${Object.keys(sourceIndex).length.toLocaleString()} source→page mappings, catalog index, metadata, and paginated pages.`);
}

main().catch((error) => {
  console.error("Catalog data generation failed:", error);
  process.exitCode = 1;
});
