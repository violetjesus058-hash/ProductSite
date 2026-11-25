import { isLongSleeve, LONG_SLEEVE_CATEGORY } from "./catalogOrdering.mjs";

/**
 * URL 筛选词表与数据推导。
 * 现有商品数据没有 season / use 字段，这里按子分类与标题做保守推导；
 * 若后续数据补齐同名字段，会优先使用数据字段。
 */
export type CatalogFacetItem = {
  category: string;
  subCategory: string;
  name: string;
  price: number;
  seasons?: string[];
  uses?: string[];
  qcAvailable?: boolean;
};

export const PRICE_OPTIONS = [
  { value: "under-10", label: "Under $10" },
  { value: "under-20", label: "Under $20" },
  { value: "under-25", label: "Under $25" },
  { value: "under-30", label: "Under $30" },
  { value: "10-20", label: "$10–$20" },
  { value: "20-30", label: "$20–$30" },
  { value: "30-50", label: "$30–$50" },
  { value: "50-plus", label: "$50+" },
];

export const SEASON_OPTIONS = [
  { value: "winter", label: "Winter" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "autumn", label: "Autumn" },
  { value: "all-season", label: "All season" },
];

export const USE_OPTIONS = [
  { value: "everyday", label: "Everyday" },
  { value: "streetwear", label: "Streetwear" },
  { value: "school", label: "School" },
  { value: "travel", label: "Travel" },
  { value: "gym", label: "Gym" },
  { value: "running", label: "Running" },
  { value: "outdoor", label: "Outdoor" },
  { value: "workwear", label: "Workwear" },
];

export const CATEGORY_OPTIONS = [
  { value: "clothing", label: "Clothing" },
  { value: "hoodies", label: "Hoodies" },
  { value: "tees", label: "Tees" },
  { value: "shirts", label: "Shirts" },
  { value: "jackets", label: "Jackets" },
  { value: "pants", label: "Pants" },
  { value: "shorts", label: "Shorts" },
  { value: "shoe", label: "Shoes" },
  { value: "sneakers", label: "Sneakers" },
  { value: "bags", label: "Bags" },
  { value: "accessories", label: "Accessories" },
  { value: "watches", label: "Watches" },
  { value: "long-sleeve", label: "Long sleeve" },
];

export function normalizeFacetToken(value: string | undefined) {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function splitFacetTokens(value: string | undefined) {
  return [...new Set((value || "").split(",").map((token) => normalizeFacetToken(token)).filter(Boolean))];
}

function itemText(item: CatalogFacetItem) {
  return `${item.subCategory || ""} ${item.name || ""}`.toLowerCase();
}

/** 商品对应的细分类 slug，用于 hoodies / tees / jackets 等 URL 参数。 */
export function subcategorySlug(item: CatalogFacetItem) {
  const raw = normalizeFacetToken(item.subCategory);
  if (raw) {
    if (raw.includes("hoodie")) return "hoodies";
    if (raw.includes("sweater")) return "sweaters";
    if (raw.includes("jacket")) return "jackets";
    if (raw.includes("short")) return "shorts";
    if (raw.includes("sneaker")) return "sneakers";
    if (raw.includes("sandal")) return "sandals";
    if (raw.includes("trouser")) return "trousers";
    if (raw.includes("jean")) return "jeans";
    if (raw.includes("sweatpant")) return "sweatpants";
    if (raw.includes("shirt")) return "shirts";
    if (raw.includes("cap")) return "caps";
    if (raw.includes("bag") || raw.includes("backpack")) return "bags";
    if (raw.includes("watch")) return "watches";
    if (raw.includes("scarf")) return "scarves";
    if (raw.includes("sock")) return "socks";
    if (raw.includes("perfume")) return "perfume";
  }
  const text = itemText(item);
  if (/\bhoodies?\b|hooded/.test(text)) return "hoodies";
  if (/\btees?\b|t-shirt|tshirt/.test(text)) return "tees";
  if (/\bshirts?\b/.test(text)) return "shirts";
  if (/\bjackets?\b|\bcoat\b/.test(text)) return "jackets";
  if (/\bshorts\b/.test(text)) return "shorts";
  if (/\bsneakers?\b/.test(text)) return "sneakers";
  if (/\bsandals?\b|\bslides?\b/.test(text)) return "sandals";
  if (/\bjeans?\b/.test(text)) return "jeans";
  if (/\bsweaters?\b/.test(text)) return "sweaters";
  if (/\bcaps?\b|\bhats?\b/.test(text)) return "caps";
  return "";
}

const CATEGORY_MATCHERS: Record<string, (item: CatalogFacetItem) => boolean> = {
  clothing: (item) => normalizeFacetToken(item.category) === "clothing",
  shoe: (item) => normalizeFacetToken(item.category) === "shoe",
  sneakers: (item) => subcategorySlug(item) === "sneakers",
  pants: (item) => normalizeFacetToken(item.category) === "pants" || ["trousers", "jeans", "sweatpants"].includes(subcategorySlug(item)),
  hoodies: (item) => subcategorySlug(item) === "hoodies",
  tees: (item) => subcategorySlug(item) === "tees",
  shirts: (item) => subcategorySlug(item) === "shirts",
  jackets: (item) => subcategorySlug(item) === "jackets",
  shorts: (item) => subcategorySlug(item) === "shorts",
  sweaters: (item) => subcategorySlug(item) === "sweaters",
  bags: (item) => normalizeFacetToken(item.category) === "bags" || subcategorySlug(item) === "bags",
  watches: (item) => normalizeFacetToken(item.category) === "watches",
  accessories: (item) => normalizeFacetToken(item.category) === "acc",
  acc: (item) => normalizeFacetToken(item.category) === "acc",
  lego: (item) => normalizeFacetToken(item.category) === "lego",
  "long-sleeve": (item) => isLongSleeve(item as never),
};

export function matchesCategoryToken(item: CatalogFacetItem, token: string) {
  const value = normalizeFacetToken(token);
  if (!value) return true;
  if (value === LONG_SLEEVE_CATEGORY || value === "long-sleeve") return isLongSleeve(item as never);
  const matcher = CATEGORY_MATCHERS[value];
  return matcher ? matcher(item) : normalizeFacetToken(item.category) === value;
}

export function matchesCategories(item: CatalogFacetItem, value: string | undefined) {
  const tokens = splitFacetTokens(value);
  return !tokens.length || tokens.some((token) => matchesCategoryToken(item, token));
}

type PriceRange = { min: number; max: number };

function parsePriceToken(token: string): PriceRange | null {
  const value = normalizeFacetToken(token);
  if (!value || value === "all") return null;
  const under = value.match(/^under-(\d+(?:\.\d+)?)$/);
  if (under) return { min: 0, max: Number(under[1]) };
  const plus = value.match(/^(\d+(?:\.\d+)?)-plus$/);
  if (plus) return { min: Number(plus[1]), max: Number.POSITIVE_INFINITY };
  const between = value.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (between) {
    const min = Number(between[1]);
    const max = Number(between[2]);
    return min < max ? { min, max } : null;
  }
  return null;
}

/** price 使用款式当前 USD 价格做数值比较，多个价格段为 OR。 */
export function matchesPrice(item: CatalogFacetItem, value: string | undefined) {
  const tokens = splitFacetTokens(value);
  if (!tokens.length || tokens.includes("all")) return true;
  const ranges = tokens.map(parsePriceToken).filter((range): range is PriceRange => !!range);
  if (!ranges.length) return true;
  return ranges.some((range) => item.price >= range.min && item.price < range.max);
}

export function seasonsFor(item: CatalogFacetItem): string[] {
  if (item.seasons?.length) return item.seasons.map(normalizeFacetToken).filter(Boolean);
  const slug = subcategorySlug(item);
  const category = normalizeFacetToken(item.category);
  const seasons = new Set<string>();
  if (["bags", "watches", "acc", "lego", "fragrance"].includes(category)) seasons.add("all-season");
  if (["hoodies", "sweaters", "jackets", "sweatpants", "trousers", "jeans", "scarves"].includes(slug)) {
    seasons.add("autumn");
    seasons.add("winter");
  }
  if (["tees", "shorts", "sandals", "socks", "caps"].includes(slug)) seasons.add("summer");
  if (["shirts", "sneakers"].includes(slug)) {
    seasons.add("spring");
    seasons.add("summer");
    seasons.add("autumn");
  }
  return [...seasons];
}

export function matchesSeason(item: CatalogFacetItem, value: string | undefined) {
  const tokens = splitFacetTokens(value).filter((token) => token === "all" || SEASON_OPTIONS.some((option) => option.value === token));
  if (!tokens.length || tokens.includes("all")) return true;
  const seasons = seasonsFor(item);
  return tokens.some((token) => seasons.includes(token));
}

export function usesFor(item: CatalogFacetItem): string[] {
  if (item.uses?.length) return item.uses.map(normalizeFacetToken).filter(Boolean);
  const slug = subcategorySlug(item);
  const text = itemText(item);
  const category = normalizeFacetToken(item.category);
  const uses = new Set<string>();
  if (["hoodies", "tees", "shirts", "jackets", "jeans", "trousers", "sweatpants", "sweaters", "shorts"].includes(slug)) {
    uses.add("everyday");
    uses.add("streetwear");
  }
  if (slug === "sneakers") {
    uses.add("everyday");
    uses.add("streetwear");
    if (/\brunning\b|\brunners?\b/.test(text)) uses.add("running");
    if (/\bgym\b|\btrainer/.test(text)) uses.add("gym");
  }
  if (slug === "jackets") uses.add("outdoor");
  if (category === "bags" || slug === "bags") {
    uses.add("everyday");
    uses.add("travel");
    if (/\bbackpack/.test(text)) uses.add("school");
  }
  if (["caps", "scarves", "watches", "accessories"].includes(slug) || category === "acc" || category === "watches") uses.add("everyday");
  if (["workwear", "uniform"].some((word) => text.includes(word))) uses.add("workwear");
  return [...uses];
}

export function matchesUse(item: CatalogFacetItem, value: string | undefined) {
  const tokens = splitFacetTokens(value).filter((token) => token === "all" || USE_OPTIONS.some((option) => option.value === token));
  if (!tokens.length || tokens.includes("all")) return true;
  const uses = usesFor(item);
  return tokens.some((token) => uses.includes(token));
}

export function matchesQc(item: CatalogFacetItem, value: string | undefined) {
  const token = normalizeFacetToken(value);
  if (token !== "available") return true;
  return item.qcAvailable === true;
}
