import { describe, expect, it } from "vitest";
import { buildCategoryRecommendationPool } from "./categoryRecommendations";

type TestProduct = {
  id: string;
  category: string;
  images: string[];
};

const catalog: TestProduct[] = [
  { id: "pants-1", category: "pants", images: ["pants-1.jpg"] },
  { id: "pants-2", category: "pants", images: ["pants-2.jpg"] },
  { id: "shoe-1", category: "shoe", images: ["shoe-1.jpg"] },
  { id: "empty-1", category: "pants", images: [] },
  { id: "acc-1", category: "ACC", images: ["acc-1.jpg"] },
];

describe("buildCategoryRecommendationPool", () => {
  it("prioritizes the selected category and excludes visible cards", () => {
    const pool = buildCategoryRecommendationPool("pants", catalog as never, new Set(["pants-1"]));
    expect(pool.map((item) => item.id)).toEqual(["pants-2", "shoe-1", "acc-1"]);
  });

  it("skips products without images and never duplicates fallback products", () => {
    const pool = buildCategoryRecommendationPool("fragrance", catalog as never);
    expect(pool.map((item) => item.id)).toEqual(["acc-1", "pants-1", "pants-2", "shoe-1"]);
    expect(new Set(pool.map((item) => item.id)).size).toBe(pool.length);
  });
});
