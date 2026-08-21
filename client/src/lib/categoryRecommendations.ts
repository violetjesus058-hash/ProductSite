import type { products } from "@/data/products";

type CatalogProduct = (typeof products)[number];
export type RecommendationEngagement = { id: string; seconds: number; lastViewedAt: number };

const RELATED_CATEGORIES: Record<string, string[]> = {
  clothing: ["pants", "shoe", "ACC"],
  pants: ["clothing", "shoe", "ACC"],
  shoe: ["clothing", "bags", "ACC"],
  bags: ["ACC", "clothing", "shoe"],
  fragrance: ["watches", "ACC", "bags"],
  watches: ["ACC", "bags", "fragrance"],
  ACC: ["bags", "watches", "shoe"],
  all: ["clothing", "pants", "shoe", "bags", "fragrance", "watches", "ACC"],
};

export function rankBehavioralRecommendations(
  pool: readonly CatalogProduct[],
  catalog: readonly CatalogProduct[],
  favoriteIds: ReadonlySet<string> = new Set(),
  engagement: readonly RecommendationEngagement[] = [],
  now = Date.now(),
  dislikedIds: ReadonlySet<string> = new Set(),
): CatalogProduct[] {
  const engagedById = new Map(engagement.map((entry) => [entry.id, entry]));
  const interests = catalog.filter((product) => favoriteIds.has(product.id) || engagedById.has(product.id));
  if (interests.length === 0) return pool.filter((product) => !dislikedIds.has(product.id));
  const score = (candidate: CatalogProduct, index: number) => {
    let total = 0;
    for (const interest of interests) {
      const engagementEntry = engagedById.get(interest.id);
      const recency = engagementEntry ? Math.max(0.25, 1 - Math.min(0.75, (now - engagementEntry.lastViewedAt) / (1000 * 60 * 60 * 24 * 30))) : 1;
      const intentWeight = (favoriteIds.has(interest.id) ? 6 : 0) + (engagementEntry ? Math.min(6, engagementEntry.seconds / 30) * recency : 0);
      if (!intentWeight) continue;
      if (candidate.category === interest.category) total += intentWeight * 1.2;
      if (candidate.subCategory && candidate.subCategory === interest.subCategory) total += intentWeight * 2;
      if (candidate.brand && candidate.brand !== "Unbranded" && candidate.brand === interest.brand) total += intentWeight * 1.4;
      const candidateTags = new Set(candidate.tags || []);
      const sharedTags = (interest.tags || []).filter((tag) => candidateTags.has(tag)).length;
      total += Math.min(3, sharedTags * 0.8) * intentWeight;
    }
    return total - index * 0.0001;
  };
  return pool.filter((product) => !dislikedIds.has(product.id)).map((product, index) => ({ product, score: score(product, index) })).sort((a, b) => b.score - a.score).map(({ product }) => product);
}

export function buildCategoryRecommendationPool(
  category: string,
  catalog: readonly CatalogProduct[],
  excludedIds: ReadonlySet<string> = new Set(),
): CatalogProduct[] {
  const seen = new Set<string>();
  const pool: CatalogProduct[] = [];
  const add = (items: readonly CatalogProduct[]) => {
    items.forEach((product) => {
      if (excludedIds.has(product.id) || seen.has(product.id) || product.images.length === 0) return;
      seen.add(product.id);
      pool.push(product);
    });
  };

  add(category === "all" ? catalog : catalog.filter((product) => product.category === category));
  (RELATED_CATEGORIES[category] || RELATED_CATEGORIES.all).forEach((relatedCategory) => {
    add(catalog.filter((product) => product.category === relatedCategory));
  });
  add(catalog);
  return pool;
}
