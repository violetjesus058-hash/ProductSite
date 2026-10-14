import { curatedPriority, isLongSleeve, LONG_SLEEVE_CATEGORY } from "./catalogOrdering.mjs";
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
export type CatalogSort = "curated" | "price-low" | "price-high" | "name" | "recent";
export type CatalogQuery = { category?: string; platform?: string; sort?: CatalogSort };
function normalized(value: string | undefined) { return (value || "").normalize("NFKC").trim().toLocaleLowerCase(); }
export function filterCatalogItems(items: CatalogSummary[], query: CatalogQuery): CatalogSummary[] {
  const category = normalized(query.category);
  const platform = normalized(query.platform);
  const filtered = items.filter((item) => {
    if (category === LONG_SLEEVE_CATEGORY ? !isLongSleeve(item) : category && normalized(item.category) !== category) return false;
    if (platform && !item.platformKeys.some((key) => normalized(key) === platform)) return false;
    return true;
  });
  switch (query.sort || "curated") {
    case "price-low": return filtered.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    case "price-high": return filtered.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    case "name": return filtered.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    case "recent": return filtered.sort((a, b) => (b.priceCheckedAt || "").localeCompare(a.priceCheckedAt || "") || a.id.localeCompare(b.id));
    default: return filtered.sort((a, b) => curatedPriority(a) - curatedPriority(b));
  }
}
export function paginateCatalogItems<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * safePageSize;
  return { page: safePage, pageSize: safePageSize, total: items.length, totalPages, items: items.slice(start, start + safePageSize) };
}
