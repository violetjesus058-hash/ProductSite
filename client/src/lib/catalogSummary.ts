import { isLongSleeve, LONG_SLEEVE_CATEGORY } from "./catalogOrdering.mjs";
import { isUnavailableCategory } from "./catalogAvailability.mjs";
export type CatalogSummary = {
  id: string;
  sourceProductId: string;
  name: string;
  styleKey: string;
  styleLabel: string;
  thumbnail: string;
  category: string;
  subCategory: string;
  price: number;
  currency: string;
  sizeCount: number;
  platformCount: number;
  primaryPlatform: string;
  platformKeys: string[];
  hasStyleImage: boolean;
  priceCheckedAt: string;
  // /spreadsheet1 品牌筛选：brand 为主品牌，brands 支持一商品多品牌。
  brand?: string;
  brands?: string[];
  // 批量替换后的商品 id，用于所有平台的购买链接（未替换的数据集不含该字段）。
  linkTargetId?: string;
};
export type CatalogSort = "curated" | "random" | "price-low" | "price-high" | "name" | "recent";
export type CatalogQuery = { category?: string; platform?: string; brand?: string; sort?: CatalogSort; seed?: number | string };

function normalized(value: string | undefined) { return (value || "").normalize("NFKC").trim().toLocaleLowerCase(); }

function productKey(item: CatalogSummary) { return item.sourceProductId || item.id; }

// 价格波动带：以当前结果均价为基准，按百分比划分高/中/低三段，
// 不使用固定金额，均价变化时阈值同步变化。
const PRICE_WAVE_HIGH = 1.5; // 均价 +50%
const PRICE_WAVE_LOW = 0.6; // 均价 -40%

function seededRandom(seed: number | string) {
  let state = 2166136261;
  for (const character of String(seed)) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/** Order a set of items so one product does not occupy adjacent rows. */
function interleaveWithinGroups(items: CatalogSummary[], random: () => number): CatalogSummary[] {
  const grouped = new Map<string, CatalogSummary[]>();
  for (const item of items) {
    const key = item.sourceProductId || item.id;
    const group = grouped.get(key) || [];
    group.push(item);
    grouped.set(key, group);
  }

  const groups = shuffle([...grouped.entries()].map(([key, group]) => ({ key, items: shuffle(group, random), offset: 0 })), random);
  const result: CatalogSummary[] = [];
  let previousGroup = "";
  while (result.length < items.length) {
    let candidates = groups.filter((group) => group.offset < group.items.length && group.key !== previousGroup);
    if (!candidates.length) candidates = groups.filter((group) => group.offset < group.items.length);
    const selected = candidates[Math.floor(random() * candidates.length)];
    result.push(selected.items[selected.offset]);
    selected.offset += 1;
    previousGroup = selected.key;
  }
  return result;
}

/**
 * Default view ordering: slice items into low/mid/high price tiers, then emit one row per tier
 * in a seed-shuffled cycle so every screen mixes price levels. Each tier queue is group-interleaved
 * and a product never repeats on adjacent rows.
 */
export function randomizeCatalogItems(items: CatalogSummary[], seed: number | string): CatalogSummary[] {
  const random = seededRandom(seed);
  const sorted = [...items].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const tiers: CatalogSummary[][] = [[], [], []];
  sorted.forEach((item, index) => tiers[Math.min(2, Math.floor((index / sorted.length) * 3))].push(item));
  const queues = tiers.map((tier) => interleaveWithinGroups(tier, random));

  const result: CatalogSummary[] = [];
  let previousProduct = "";
  while (result.length < items.length) {
    const order = shuffle([0, 1, 2], random).filter((tier) => queues[tier].length > 0);
    for (const tier of order) {
      const queue = queues[tier];
      let index = queue.findIndex((item) => (item.sourceProductId || item.id) !== previousProduct);
      if (index === -1) index = 0;
      const [item] = queue.splice(index, 1);
      result.push(item);
      previousProduct = item.sourceProductId || item.id;
    }
  }
  return result;
}

/** Keep a sorted list roughly intact while preventing two styles of one product from sitting together. */
function interleaveAdjacentGroups(items: CatalogSummary[]): CatalogSummary[] {
  const result = [...items];
  for (let index = 1; index < result.length; index += 1) {
    if (productKey(result[index]) !== productKey(result[index - 1])) continue;
    let swapIndex = index + 1;
    while (swapIndex < result.length && productKey(result[swapIndex]) === productKey(result[index - 1])) swapIndex += 1;
    if (swapIndex < result.length) [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/**
 * Price wave: split the result set into three bands by percentage distance from its average
 * price, then emit one row from each band in a repeating cycle so prices move up and down.
 * Same-product styles are interleaved inside every band and across band boundaries.
 */
export function waveCatalogItems(items: CatalogSummary[], seed: number | string, start: "random" | "high" | "low" = "random"): CatalogSummary[] {
  if (!items.length) return [];
  const random = seededRandom(seed);
  const average = items.reduce((sum, item) => sum + item.price, 0) / items.length;
  const high: CatalogSummary[] = [];
  const middle: CatalogSummary[] = [];
  const low: CatalogSummary[] = [];
  for (const item of items) {
    if (average > 0 && item.price > average * PRICE_WAVE_HIGH) high.push(item);
    else if (average > 0 && item.price <= average * PRICE_WAVE_LOW) low.push(item);
    else middle.push(item);
  }
  const queues = {
    high: interleaveWithinGroups(high, random),
    middle: interleaveWithinGroups(middle, random),
    low: interleaveWithinGroups(low, random),
  };
  const offsets = { high: 0, middle: 0, low: 0 };
  const baseOrder: Array<keyof typeof queues> = start === "high" ? ["high", "middle", "low"] : start === "low" ? ["low", "middle", "high"] : ["high", "middle", "low"];
  const result: CatalogSummary[] = [];
  while (result.length < items.length) {
    const order = start === "random" ? shuffle(baseOrder, random) : baseOrder;
    let emitted = false;
    for (const key of order) {
      if (offsets[key] >= queues[key].length) continue;
      result.push(queues[key][offsets[key]]);
      offsets[key] += 1;
      emitted = true;
    }
    if (!emitted) break;
  }
  return interleaveAdjacentGroups(result);
}

export function filterCatalogItems(items: CatalogSummary[], query: CatalogQuery): CatalogSummary[] {
  const category = normalized(query.category);
  const platform = normalized(query.platform);
  const brand = normalized(query.brand);
  const filtered = items.filter((item) => {
    if (isUnavailableCategory(item.category)) return false;
    if (category === LONG_SLEEVE_CATEGORY ? !isLongSleeve(item) : category && normalized(item.category) !== category) return false;
    if (platform && !item.platformKeys.some((key) => normalized(key) === platform)) return false;
    if (brand) {
      const brands = item.brands?.length ? item.brands : item.brand ? [item.brand] : [];
      if (!brands.some((value) => normalized(value) === brand)) return false;
    }
    return true;
  });
  switch (query.sort || "curated") {
    case "curated": return waveCatalogItems(filtered, query.seed ?? 0, "random");
    case "random": return randomizeCatalogItems(filtered, query.seed ?? 0);
    case "price-low": return waveCatalogItems(filtered, query.seed ?? 0, "low");
    case "price-high": return waveCatalogItems(filtered, query.seed ?? 0, "high");
    case "name": return interleaveAdjacentGroups(filtered.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
    case "recent": return interleaveAdjacentGroups(filtered.sort((a, b) => (b.priceCheckedAt || "").localeCompare(a.priceCheckedAt || "") || a.id.localeCompare(b.id)));
    default: return waveCatalogItems(filtered, query.seed ?? 0, "random");
  }
}

export function paginateCatalogItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * safePageSize;
  return { page: safePage, pageSize: safePageSize, total: items.length, totalPages, items: items.slice(start, start + safePageSize) };
}
