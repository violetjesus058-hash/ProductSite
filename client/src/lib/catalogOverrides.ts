import type { CatalogSummary } from "./catalogSummary";
import { platformSourcesFor, primarySourceFor } from "./platformSources.mjs";

type UnknownRecord = Record<string, unknown>;
export type CatalogProductOverride = UnknownRecord & {
  id?: unknown;
  sourceProductId?: unknown;
  name?: unknown;
  catalogName?: unknown;
  category?: unknown;
  subCategory?: unknown;
  styleKey?: unknown;
  styleLabel?: unknown;
  price?: unknown;
  currency?: unknown;
  sizes?: unknown;
  images?: unknown;
  platformLinks?: unknown;
  url?: unknown;
  collectedAt?: unknown;
  priceCheckedAt?: unknown;
};
export type CatalogPreviewStyle = {
  id: string;
  styleKey: string;
  styleLabel: string;
  image: string;
  price: number;
  currency: string;
};
export type CatalogPreviewGroup = {
  sourceProductId: string;
  name: string;
  platforms: Array<{ name: string; url: string; primary?: boolean }>;
  styles: CatalogPreviewStyle[];
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function asNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function asTextArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()) : [];
}
function styleKeyFor(item: CatalogProductOverride, fallback = "") {
  const explicit = asText(item.styleKey);
  if (explicit) return explicit.toLowerCase();
  const candidate = asTextArray(item.sizes).find((value) => /[;:|]/.test(value));
  return candidate?.split(/[;:|]/)[0].trim().toLowerCase() || fallback;
}
function itemId(item: CatalogProductOverride) { return asText(item.id); }
function sourceIdFor(item: CatalogProductOverride, fallback = "") {
  return asText(item.sourceProductId, fallback || itemId(item));
}

function summaryFromOverride(item: CatalogProductOverride, previous?: CatalogSummary): CatalogSummary | null {
  const id = itemId(item) || previous?.id || "";
  if (!id) return null;
  const sourceProductId = sourceIdFor(item, previous?.sourceProductId || id);
  const product = { ...item, id, sourceProductId };
  const sizes = asTextArray(item.sizes);
  const images = asTextArray(item.images);
  const hasPlatformData = Object.prototype.hasOwnProperty.call(item, "platformLinks") || Object.prototype.hasOwnProperty.call(item, "url");
  const platforms = hasPlatformData ? platformSourcesFor(product as Parameters<typeof platformSourcesFor>[0]) : [];
  const platformKeys = hasPlatformData ? platforms.map((platform) => platform.name) : previous?.platformKeys || [];
  const primaryPlatform = hasPlatformData ? primarySourceFor(product as Parameters<typeof primarySourceFor>[0])?.name || platformKeys[0] || "" : previous?.primaryPlatform || "";
  const image = images[0] || previous?.thumbnail || "/catalog-detail-stilllife.webp";
  return {
    id,
    sourceProductId,
    name: asText(item.catalogName, asText(item.name, previous?.name || "Catalog item")),
    styleKey: styleKeyFor(item, previous?.styleKey || ""),
    styleLabel: asText(item.styleLabel, previous?.styleLabel || ""),
    thumbnail: image,
    category: asText(item.category, previous?.category || ""),
    subCategory: asText(item.subCategory, previous?.subCategory || ""),
    price: asNumber(item.price, previous?.price || 0),
    currency: asText(item.currency, previous?.currency || "USD"),
    sizeCount: Array.isArray(item.sizes) ? sizes.length : previous?.sizeCount || 0,
    platformCount: hasPlatformData ? platformKeys.length : previous?.platformCount || 0,
    primaryPlatform,
    platformKeys,
    hasStyleImage: previous?.hasStyleImage || false,
    priceCheckedAt: asText(item.priceCheckedAt, asText(item.collectedAt, previous?.priceCheckedAt || "")),
  };
}

/** Overlay live Worker products over generated catalog rows and append new Worker products. */
export function mergeCatalogOverrides(baseRows: CatalogSummary[], overrides: CatalogProductOverride[]): CatalogSummary[] {
  const rows = new Map(baseRows.map((row) => [row.id, row]));
  for (const override of overrides) {
    const id = itemId(override);
    if (!id) continue;
    const merged = summaryFromOverride(override, rows.get(id));
    if (merged) rows.set(id, merged);
  }
  return [...rows.values()];
}

/** Apply live Worker fields to the expanded style group while retaining generated style imagery as fallback. */
export function mergePreviewOverrides(
  baseGroup: CatalogPreviewGroup | null,
  sourceProductId: string,
  overrides: CatalogProductOverride[],
): CatalogPreviewGroup | null {
  const existingStyleIds = new Set((baseGroup?.styles || []).map((style) => style.id));
  const matching = overrides.filter((item) => sourceIdFor(item) === sourceProductId || existingStyleIds.has(itemId(item)));
  if (!matching.length) return baseGroup;

  const styles = new Map((baseGroup?.styles || []).map((style) => [style.id, style]));
  for (const item of matching) {
    const id = itemId(item);
    if (!id) continue;
    const previous = styles.get(id);
    const images = asTextArray(item.images);
    styles.set(id, {
      id,
      styleKey: styleKeyFor(item, previous?.styleKey || ""),
      styleLabel: asText(item.styleLabel, previous?.styleLabel || ""),
      image: images[0] || previous?.image || "/catalog-detail-stilllife.webp",
      price: asNumber(item.price, previous?.price || 0),
      currency: asText(item.currency, previous?.currency || "USD"),
    });
  }

  const first = matching[0];
  const hasPlatformData = Object.prototype.hasOwnProperty.call(first, "platformLinks") || Object.prototype.hasOwnProperty.call(first, "url");
  const platforms = hasPlatformData
    ? platformSourcesFor({ ...first, sourceProductId } as Parameters<typeof platformSourcesFor>[0])
    : baseGroup?.platforms || [];
  return {
    sourceProductId,
    name: asText(first.catalogName, asText(first.name, baseGroup?.name || "Catalog item")),
    platforms,
    styles: [...styles.values()],
  };
}
