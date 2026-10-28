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
};
export type CatalogSort = "random" | "price-low" | "price-high" | "name" | "recent";
export type CatalogQuery = { category?: string; platform?: string; sort?: CatalogSort; seed?: number | string };

function normalized(value: string | undefined) { return (value || "").normalize("NFKC").trim().toLocaleLowerCase(); }

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

export function filterCatalogItems(items: CatalogSummary[], query: CatalogQuery): CatalogSummary[] {
  const category = normalized(query.category);
  const platform = normalized(query.platform);
  const filtered = items.filter((item) => {
    if (isUnavailableCategory(item.category)) return false;
    if (category === LONG_SLEEVE_CATEGORY ? !isLongSleeve(item) : category && normalized(item.category) !== category) return false;
    if (platform && !item.platformKeys.some((key) => normalized(key) === platform)) return false;
    return true;
  });
  switch (query.sort || "random") {
    case "price-low": return filtered.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    case "price-high": return filtered.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    case "name": return filtered.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    case "recent": return filtered.sort((a, b) => (b.priceCheckedAt || "").localeCompare(a.priceCheckedAt || "") || a.id.localeCompare(b.id));
    default: return randomizeCatalogItems(filtered, query.seed ?? 0);
  }
}

export function paginateCatalogItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * safePageSize;
  return { page: safePage, pageSize: safePageSize, total: items.length, totalPages, items: items.slice(start, start + safePageSize) };
}
