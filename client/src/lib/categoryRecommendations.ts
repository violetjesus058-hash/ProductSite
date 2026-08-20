import type { products } from "@/data/products";

type CatalogProduct = (typeof products)[number];

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
