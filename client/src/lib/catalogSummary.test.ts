import { describe, expect, it } from "vitest";
import { ALL_BRANDS, filterCatalogItems, paginateCatalogItems, type CatalogSummary } from "./catalogSummary";

function item(id: string, sourceProductId: string, category: string, price: number, overrides: Partial<CatalogSummary> = {}): CatalogSummary {
  return {
    id,
    sourceProductId,
    name: `${sourceProductId} product`,
    styleKey: id,
    styleLabel: id,
    thumbnail: `/${id}.webp`,
    category,
    subCategory: "",
    price,
    currency: "USD",
    sizeCount: 1,
    platformCount: 1,
    primaryPlatform: "Shop",
    platformKeys: ["Shop"],
    hasStyleImage: false,
    priceCheckedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const catalog = [
  item("a-1", "product-a", "shoe", 30), item("a-2", "product-a", "shoe", 31),
  item("b-1", "product-b", "clothing", 20), item("b-2", "product-b", "clothing", 21),
  item("c-1", "product-c", "bags", 40), item("c-2", "product-c", "bags", 41),
  item("d-1", "product-d", "shoe", 10), item("d-2", "product-d", "shoe", 11),
  item("e-1", "product-e", "clothing", 50), item("e-2", "product-e", "clothing", 51),
  item("f-1", "product-f", "bags", 60), item("f-2", "product-f", "bags", 61),
];

describe("spreadsheet catalog ordering", () => {
  it("uses a stable curated wave by default", () => {
    const implicit = filterCatalogItems(catalog, {});
    const explicit = filterCatalogItems(catalog, { sort: "curated", seed: 0 });
    expect(implicit.map((entry) => entry.id)).toEqual(explicit.map((entry) => entry.id));
  });

  it("keeps random order stable for the same seed", () => {
    const explicit = filterCatalogItems(catalog, { sort: "random", seed: 12345 });
    const repeated = filterCatalogItems(catalog, { sort: "random", seed: 12345 });
    expect(explicit.map((entry) => entry.id)).toEqual(repeated.map((entry) => entry.id));
    expect(explicit.map((entry) => entry.id)).not.toEqual(filterCatalogItems(catalog, { sort: "random", seed: 54321 }).map((entry) => entry.id));
  });

  it("interleaves styles from different products near the start of the randomized list", () => {
    const ordered = filterCatalogItems(catalog, { sort: "random", seed: 12345 });
    const openingRows = ordered.slice(0, 10);
    for (let index = 1; index < openingRows.length; index += 1) {
      expect(openingRows[index].sourceProductId).not.toBe(openingRows[index - 1].sourceProductId);
    }
  });

  it("randomizes within the selected category without mixing other categories", () => {
    const shoes = filterCatalogItems(catalog, { category: "shoe", sort: "random", seed: 12345 });
    expect(shoes).toHaveLength(4);
    expect(shoes.every((entry) => entry.category === "shoe")).toBe(true);
    expect(new Set(shoes.map((entry) => entry.sourceProductId)).size).toBeGreaterThan(1);
  });

  it("keeps page slices aligned with the full stable random order", () => {
    const ordered = filterCatalogItems(catalog, { sort: "random", seed: 98765 });
    const firstPage = paginateCatalogItems(ordered, 1, 5);
    const secondPage = paginateCatalogItems(ordered, 2, 5);
    const finalPage = paginateCatalogItems(ordered, 3, 5);
    expect([...firstPage.items, ...secondPage.items, ...finalPage.items]).toEqual(ordered);
  });

  it("orders price sorts as an average-based wave and keeps products apart", () => {
    const prices = catalog.map((entry) => entry.price);
    const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const lowFirst = filterCatalogItems(catalog, { sort: "price-low", seed: 12345 });
    const highFirst = filterCatalogItems(catalog, { sort: "price-high", seed: 12345 });
    expect(lowFirst).toHaveLength(catalog.length);
    expect(highFirst).toHaveLength(catalog.length);
    expect(lowFirst[0].price).toBeLessThanOrEqual(average * 0.6);
    expect(highFirst[0].price).toBeGreaterThan(average * 1.5);
    for (const ordered of [lowFirst, highFirst]) {
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index].sourceProductId).not.toBe(ordered[index - 1].sourceProductId);
      }
    }
    const wavePrices = lowFirst.map((entry) => entry.price);
    expect(wavePrices).not.toEqual([...wavePrices].sort((a, b) => a - b));
  });

  it("filters All Brands to products with a real brand tag", () => {
    const branded = [
      { ...item("g-1", "product-g", "shoe", 10), brand: "Nike", brands: ["Nike"] },
      { ...item("h-1", "product-h", "shoe", 20), brand: "Unbranded", brands: ["Unbranded"] },
      { ...item("i-1", "product-i", "shoe", 30), brand: "Unbranded", brands: ["Unbranded", "adidas"] },
      { ...item("j-1", "product-j", "shoe", 40), brand: "Unbranded" },
    ];
    const result = filterCatalogItems(branded, { brand: ALL_BRANDS, sort: "random", seed: 1 });
    expect(result.map((entry) => entry.id).sort()).toEqual(["g-1", "i-1"]);
  });

  it("accepts hyphen and underscore variants in the brand parameter", () => {
    const branded = [
      { ...item("k-1", "product-k", "shoe", 10), brand: "Ralph Lauren", brands: ["Ralph Lauren"] },
      { ...item("l-1", "product-l", "shoe", 20), brand: "Unbranded", brands: ["Unbranded"] },
    ];
    expect(filterCatalogItems(branded, { brand: "ralph-lauren" }).map((entry) => entry.id)).toEqual(["k-1"]);
    expect(filterCatalogItems(branded, { brand: "Ralph_Lauren" }).map((entry) => entry.id)).toEqual(["k-1"]);
    expect(filterCatalogItems(branded, { brand: "  Ralph   Lauren  " }).map((entry) => entry.id)).toEqual(["k-1"]);
  });
});

describe("spreadsheet catalog URL facets", () => {
  const ids = (items: CatalogSummary[]) => items.map((entry) => entry.id).sort();
  const priced = [
    item("p1", "p1", "clothing", 9.99),
    item("p2", "p2", "clothing", 10),
    item("p3", "p3", "clothing", 19.99),
    item("p4", "p4", "clothing", 20),
    item("p5", "p5", "clothing", 25),
    item("p6", "p6", "clothing", 50),
    item("p7", "p7", "clothing", 75),
  ];

  it("compares prices numerically with exclusive upper bounds", () => {
    expect(ids(filterCatalogItems(priced, { price: "under-10" }))).toEqual(["p1"]);
    expect(ids(filterCatalogItems(priced, { price: "under-20" }))).toEqual(["p1", "p2", "p3"]);
    expect(ids(filterCatalogItems(priced, { price: "under-25" }))).toEqual(["p1", "p2", "p3", "p4"]);
    expect(ids(filterCatalogItems(priced, { price: "20-30" }))).toEqual(["p4", "p5"]);
    expect(ids(filterCatalogItems(priced, { price: "50-plus" }))).toEqual(["p6", "p7"]);
  });

  it("treats comma-separated prices as OR and ignores unknown price tokens", () => {
    expect(ids(filterCatalogItems(priced, { price: "10-20,50-plus" }))).toEqual(["p2", "p3", "p6", "p7"]);
    expect(ids(filterCatalogItems(priced, { price: "all" }))).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(ids(filterCatalogItems(priced, { price: "cheap" }))).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
  });

  const styles = [
    item("sandal", "ps2", "shoe", 20, { subCategory: "Sandals" }),
    item("sneaker", "ps1", "shoe", 30, { subCategory: "Sneakers" }),
    item("cap", "pa1", "ACC", 15, { subCategory: "Caps" }),
    item("hoodie", "ph1", "clothing", 25, { subCategory: "Hoodies" }),
    item("shirt", "pt1", "clothing", 18, { subCategory: "Shirts" }),
  ];

  it("maps category aliases and subcategory slugs", () => {
    expect(ids(filterCatalogItems(styles, { category: "shoe" }))).toEqual(["sandal", "sneaker"]);
    expect(ids(filterCatalogItems(styles, { category: "sneakers" }))).toEqual(["sneaker"]);
    expect(ids(filterCatalogItems(styles, { category: "ACC" }))).toEqual(["cap"]);
    expect(ids(filterCatalogItems(styles, { category: "accessories" }))).toEqual(["cap"]);
    expect(ids(filterCatalogItems(styles, { category: "clothing" }))).toEqual(["hoodie", "shirt"]);
    expect(ids(filterCatalogItems(styles, { category: "hoodies,tees" }))).toEqual(["hoodie"]);
    expect(ids(filterCatalogItems([...styles, item("acc-tee", "pa2", "ACC", 12, { subCategory: "Selection", name: "Tee Keychain" })], { category: "tees" }))).toEqual([]);
  });

  const seasonal = [
    item("hoodie", "pw1", "clothing", 25, { subCategory: "Hoodies" }),
    item("tee", "pt1", "clothing", 15, { subCategory: "Tees" }),
    item("bag", "pb1", "bags", 30, { subCategory: "Backpacks" }),
  ];

  it("filters seasons from subcategory rules and combines different parameters with AND", () => {
    expect(ids(filterCatalogItems(seasonal, { season: "winter" }))).toEqual(["hoodie"]);
    expect(ids(filterCatalogItems(seasonal, { season: "summer" }))).toEqual(["tee"]);
    expect(ids(filterCatalogItems(seasonal, { season: "all-season" }))).toEqual(["bag"]);
    expect(ids(filterCatalogItems(seasonal, { category: "clothing", season: "winter" }))).toEqual(["hoodie"]);
    expect(ids(filterCatalogItems(seasonal, { season: "winter,summer" }))).toEqual(["hoodie", "tee"]);
    expect(ids(filterCatalogItems(seasonal, { season: "monsoon" }))).toEqual(["bag", "hoodie", "tee"]);
  });

  const usage = [
    item("run", "pr1", "shoe", 40, { subCategory: "Sneakers", name: "Running Sneakers" }),
    item("walk", "pr2", "shoe", 35, { subCategory: "Sneakers", name: "Casual Sneakers" }),
    item("pack", "pb1", "bags", 30, { subCategory: "Backpacks" }),
    item("hoodie", "ph1", "clothing", 25, { subCategory: "Hoodies" }),
  ];

  it("filters use tags and supports comma-separated values", () => {
    expect(ids(filterCatalogItems(usage, { use: "running" }))).toEqual(["run"]);
    expect(ids(filterCatalogItems(usage, { use: "school" }))).toEqual(["pack"]);
    expect(ids(filterCatalogItems(usage, { use: "travel" }))).toEqual(["pack"]);
    expect(ids(filterCatalogItems(usage, { use: "streetwear" }))).toEqual(["hoodie", "run", "walk"]);
    expect(ids(filterCatalogItems(usage, { use: "gym,travel" }))).toEqual(["pack"]);
    expect(ids(filterCatalogItems(usage, { use: "brunch" }))).toEqual(["hoodie", "pack", "run", "walk"]);
  });

  it("only filters QC when the data flag exists", () => {
    const withQc = [...usage, item("qc", "pq1", "shoe", 45, { subCategory: "Sneakers", qcAvailable: true })];
    expect(ids(filterCatalogItems(withQc, { qc: "available" }))).toEqual(["qc"]);
    expect(ids(filterCatalogItems(usage, { qc: "available" }))).toEqual([]);
    expect(ids(filterCatalogItems(usage, { qc: "unknown" }))).toEqual(["hoodie", "pack", "run", "walk"]);
  });
});
