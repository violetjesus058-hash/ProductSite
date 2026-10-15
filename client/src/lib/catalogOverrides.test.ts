import { describe, expect, it } from "vitest";
import { mergeCatalogOverrides, mergePreviewOverrides, type CatalogProductOverride } from "./catalogOverrides";
import type { CatalogSummary } from "./catalogSummary";

const baseRow: CatalogSummary = {
  id: "style-1",
  sourceProductId: "source-1",
  name: "Old name",
  styleKey: "1",
  styleLabel: "1",
  thumbnail: "/old.webp",
  category: "clothing",
  subCategory: "tops",
  price: 20,
  currency: "USD",
  sizeCount: 2,
  platformCount: 1,
  primaryPlatform: "OldShop",
  platformKeys: ["OldShop"],
  hasStyleImage: false,
  priceCheckedAt: "2026-01-01T00:00:00.000Z",
};

describe("live catalog product overrides", () => {
  it("updates existing rows and appends Worker-only products", () => {
    const overrides: CatalogProductOverride[] = [
      { id: "style-1", sourceProductId: "source-1", name: "Updated name", category: "shoe", price: 35, currency: "EUR", sizes: ["EU 39", "EU 40", "EU 41"], images: ["/new.webp"], url: "https://fansbuy.com/item-micro-123456.html", platformLinks: { Superbuy: "https://superbuy.com/item/123456" }, priceCheckedAt: "2026-10-15T00:00:00.000Z" },
      { id: "new-style", sourceProductId: "new-source", name: "New product", category: "bags", price: 12, images: ["/new-product.webp"], url: "https://fansbuy.com/item-micro-654321.html", platformLinks: {} },
    ];
    const result = mergeCatalogOverrides([baseRow], overrides);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "style-1", name: "Updated name", category: "shoe", price: 35, currency: "EUR", sizeCount: 3, thumbnail: "/new.webp", primaryPlatform: "Fansbuy" });
    expect(result[0].platformKeys).toContain("Superbuy");
    expect(result[1]).toMatchObject({ id: "new-style", sourceProductId: "new-source", name: "New product", category: "bags", thumbnail: "/new-product.webp" });
  });

  it("updates the expanded style price, image, name and buying platforms", () => {
    const base = {
      sourceProductId: "source-1",
      name: "Old name",
      platforms: [{ name: "OldShop", url: "https://old.example/item" }],
      styles: [{ id: "style-1", styleKey: "1", styleLabel: "1", image: "/old.webp", price: 20, currency: "USD" }],
    };
    const result = mergePreviewOverrides(base, "source-1", [
      { id: "style-1", sourceProductId: "source-1", catalogName: "Updated name", price: 35, currency: "EUR", images: ["/new.webp"], url: "https://fansbuy.com/item-micro-123456.html", platformLinks: { Superbuy: "https://superbuy.com/item/123456" } },
    ]);
    expect(result?.name).toBe("Updated name");
    expect(result?.styles[0]).toMatchObject({ id: "style-1", image: "/new.webp", price: 35, currency: "EUR" });
    expect(result?.platforms.map((platform) => platform.name)).toContain("Fansbuy");
  });

  it("creates an expanded group for a Worker-only product", () => {
    const result = mergePreviewOverrides(null, "new-source", [
      { id: "new-style", sourceProductId: "new-source", name: "New product", price: 12, images: ["/new.webp"], url: "https://fansbuy.com/item-micro-654321.html", platformLinks: {} },
    ]);
    expect(result).toMatchObject({ sourceProductId: "new-source", name: "New product" });
    expect(result?.styles).toHaveLength(1);
    expect(result?.styles[0]).toMatchObject({ id: "new-style", image: "/new.webp", price: 12 });
  });
});
