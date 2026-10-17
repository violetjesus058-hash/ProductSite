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
  const productChunkStats = await writeProductChunks(orderedProducts);
  const fileCount = (await fs.readdir(previewDir)).length;
  console.log(`Generated ${products.length.toLocaleString()} product records, ${fileCount.toLocaleString()} purchase previews, ${productChunkStats.count} product chunks (largest ${productChunkStats.largestChunkBytes.toLocaleString()} bytes), catalog index, metadata, and paginated pages.`);
}

main().catch((error) => {
  console.error("Catalog data generation failed:", error);
  process.exitCode = 1;
});
