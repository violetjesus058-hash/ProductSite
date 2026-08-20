import { describe, expect, it } from "vitest";
import { nextSafeImageSource } from "@/components/SafeProductImage";

describe("safe product image fallback", () => {
  it("advances to the next gallery image after a failed source", () => {
    expect(nextSafeImageSource(["first.jpg", "second.jpg"], 0)).toEqual({ source: "second.jpg", index: 1, failedAll: false });
  });

  it("returns the stable catalog placeholder after the last source fails", () => {
    expect(nextSafeImageSource(["only.jpg"], 0)).toEqual({ source: "/catalog-detail-stilllife.jpg", index: 0, failedAll: true });
  });
});
