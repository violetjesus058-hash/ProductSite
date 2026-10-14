export type CatalogOrderingItem = {
  category?: unknown;
  name?: unknown;
  subCategory?: unknown;
};
export const LONG_SLEEVE_CATEGORY: string;
export function isLongSleeve(item: CatalogOrderingItem): boolean;
export function curatedPriority(item: CatalogOrderingItem): number;
