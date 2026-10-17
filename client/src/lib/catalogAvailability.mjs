export const unavailableCategoryKeys = new Set(["fragrance"]);

export function isUnavailableCategory(category) {
  return unavailableCategoryKeys.has(String(category || "").trim().toLowerCase());
}
