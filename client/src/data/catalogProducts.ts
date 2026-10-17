import { useSyncExternalStore } from "react";
import type { Product } from "./products";
import { isUnavailableCategory } from "@/lib/catalogAvailability.mjs";

export type { Product } from "./products";

export const products: Product[] = [];

const PAGE_SIZE = 60;
const CATALOG_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-data`;
const CACHE_DB_NAME = "productsite-catalog-cache";
const CACHE_DB_VERSION = 1;
const CACHE_META_STORE = "meta";
const CACHE_PAGE_STORE = "pages";

type CatalogMeta = {
  total: number;
  generatedAt?: string;
  pageSizes?: number[];
};

type CatalogPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: Product[];
};

type CatalogSnapshot = {
  total: number;
  loaded: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  version: string;
};

const listeners = new Set<() => void>();
const loadedPages = new Set<number>();
const loadingPages = new Map<number, Promise<void>>();
let catalogMeta: CatalogMeta | null = null;
let cacheDatabase: Promise<IDBDatabase | null> | null = null;
let snapshot: CatalogSnapshot = {
  total: 0,
  loaded: 0,
  page: 0,
  totalPages: 0,
  isLoading: true,
  error: null,
  version: "",
};

function emit() {
  listeners.forEach((listener) => listener());
}

function updateSnapshot(next: Partial<CatalogSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalogSnapshot() {
  return snapshot;
}

export function useCatalogVersion() {
  return useSyncExternalStore(subscribe, getCatalogSnapshot, getCatalogSnapshot);
}

function openCacheDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (cacheDatabase) return cacheDatabase;
  cacheDatabase = new Promise((resolve) => {
    const request = window.indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_META_STORE)) database.createObjectStore(CACHE_META_STORE);
      if (!database.objectStoreNames.contains(CACHE_PAGE_STORE)) database.createObjectStore(CACHE_PAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return cacheDatabase;
}

async function readCachedMeta() {
  const database = await openCacheDatabase();
  if (!database) return null;
  return new Promise<{ version: string; meta: CatalogMeta } | null>((resolve) => {
    const request = database.transaction(CACHE_META_STORE, "readonly").objectStore(CACHE_META_STORE).get("catalog");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function writeCachedMeta(version: string, meta: CatalogMeta) {
  const database = await openCacheDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const request = database.transaction(CACHE_META_STORE, "readwrite").objectStore(CACHE_META_STORE).put({ version, meta }, "catalog");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

async function readCachedPage(version: string, page: number) {
  const database = await openCacheDatabase();
  if (!database) return null;
  return new Promise<CatalogPage | null>((resolve) => {
    const request = database.transaction(CACHE_PAGE_STORE, "readonly").objectStore(CACHE_PAGE_STORE).get(`${version}:${page}`);
    request.onsuccess = () => resolve(request.result?.page || null);
    request.onerror = () => resolve(null);
  });
}

async function writeCachedPage(version: string, page: number, value: CatalogPage) {
  const database = await openCacheDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const request = database.transaction(CACHE_PAGE_STORE, "readwrite").objectStore(CACHE_PAGE_STORE).put({ version, page: value }, `${version}:${page}`);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

async function fetchCatalogMeta() {
  const response = await fetch(`${CATALOG_BASE}/meta.json`, { headers: { accept: "application/json" }, cache: "no-cache" });
  if (!response.ok) throw new Error(`Product catalog metadata failed (${response.status}).`);
  return response.json() as Promise<CatalogMeta>;
}

async function fetchCatalogPage(page: number) {
  const response = await fetch(`${CATALOG_BASE}/pages-${PAGE_SIZE}/${page}.json`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Product catalog page failed (${response.status}).`);
  return response.json() as Promise<CatalogPage>;
}

async function loadPage(page: number) {
  if (loadedPages.has(page)) return;
  const existing = loadingPages.get(page);
  if (existing) return existing;

  const request = (async () => {
    if (!catalogMeta) catalogMeta = await fetchCatalogMeta();
    const version = catalogMeta.generatedAt || "catalog";
    const cached = await readCachedPage(version, page);
    const payload = cached || await fetchCatalogPage(page);
    if (!cached) await writeCachedPage(version, page, payload);
    const knownIds = new Set(products.map((product) => product.id));
    products.push(...payload.items.filter((product) => !isUnavailableCategory(product.category) && !knownIds.has(product.id)));
    loadedPages.add(page);
    updateSnapshot({
      total: payload.total || catalogMeta.total,
      loaded: products.length,
      page: Math.max(snapshot.page, page),
      totalPages: payload.totalPages || Math.ceil((payload.total || catalogMeta.total) / PAGE_SIZE),
      isLoading: false,
      error: null,
      version,
    });
  })();

  loadingPages.set(page, request);
  try {
    await request;
  } catch (error) {
    updateSnapshot({ isLoading: false, error: error instanceof Error ? error.message : "Product catalog loading failed." });
    throw error;
  } finally {
    loadingPages.delete(page);
  }
}

async function initializeCatalog() {
  try {
    const remoteMeta = await fetchCatalogMeta();
    const remoteVersion = remoteMeta.generatedAt || "catalog";
    const cachedMeta = await readCachedMeta();
    catalogMeta = remoteMeta;
    updateSnapshot({ total: remoteMeta.total, totalPages: Math.ceil(remoteMeta.total / PAGE_SIZE), version: remoteVersion, isLoading: true, error: null });
    if (!cachedMeta || cachedMeta.version !== remoteVersion) await writeCachedMeta(remoteVersion, remoteMeta);
    await loadPage(1);
    return products;
  } catch (error) {
    updateSnapshot({ isLoading: false, error: error instanceof Error ? error.message : "Product catalog loading failed." });
    throw error;
  }
}

export async function loadNextCatalogPage() {
  if (snapshot.isLoading) return;
  if (snapshot.totalPages > 0 && snapshot.page >= snapshot.totalPages) return;
  await loadPage(Math.max(1, snapshot.page + 1));
}

export const productsReady = initializeCatalog();
await productsReady;

export const categoryLabels: Record<string, string> = {
  clothing: "Clothing",
  shoe: "Shoes",
  pants: "Pants",
  bags: "Bags",
  ACC: "Accessories",
  watches: "Watches",
};
export const categoryOrder = ["all", "clothing", "pants", "shoe", "bags", "watches", "ACC"];
