import { describe, expect, it } from "vitest";
import { filterCatalogItems, paginateCatalogItems, type CatalogSummary } from "./catalogSummary";

function item(id: string, sourceProductId: string, category: string, price: number): CatalogSummary {
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
  it("uses random order by default and keeps the same visit order stable", () => {
    const implicit = filterCatalogItems(catalog, {});
    const explicit = filterCatalogItems(catalog, { sort: "random", seed: 12345 });
    const repeated = filterCatalogItems(catalog, { sort: "random", seed: 12345 });
    expect(implicit.map((entry) => entry.id)).toEqual(filterCatalogItems(catalog, { sort: "random", seed: 0 }).map((entry) => entry.id));
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

  it("retains explicit price sorting", () => {
    const lowToHigh = filterCatalogItems(catalog, { sort: "price-low", seed: 12345 });
    expect(lowToHigh.map((entry) => entry.price)).toEqual([...lowToHigh.map((entry) => entry.price)].sort((a, b) => a - b));
  });
});
