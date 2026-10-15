import { useSyncExternalStore } from "react";
import type { Product } from "./products";

export type { Product } from "./products";

export const products: Product[] = [];

type CatalogManifest = {
  total: number;
  chunks: string[];
  generatedAt?: string;
};

type CatalogSnapshot = {
  total: number;
  loaded: number;
  totalChunks: number;
  loadedChunks: number;
  isLoading: boolean;
  error: string | null;
};

const listeners = new Set<() => void>();
const loadedChunks = new Set<string>();
const loadingChunks = new Map<string, Promise<void>>();
let manifest: CatalogManifest | null = null;
let snapshot: CatalogSnapshot = {
  total: 0,
  loaded: 0,
  totalChunks: 0,
  loadedChunks: 0,
  isLoading: true,
  error: null,
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

async function loadChunk(name: string) {
  if (loadedChunks.has(name)) return;
  const existing = loadingChunks.get(name);
  if (existing) return existing;

  const request = (async () => {
    const basePath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-data/products`;
    const response = await fetch(`${basePath}/${encodeURIComponent(name)}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Product catalog chunk failed (${response.status}): ${name}`);
    const chunk = await response.json() as Product[];
    products.push(...chunk);
    loadedChunks.add(name);
    updateSnapshot({ loaded: products.length, loadedChunks: loadedChunks.size });
  })();

  loadingChunks.set(name, request);
  try {
    await request;
  } finally {
    loadingChunks.delete(name);
  }
}

async function loadRemainingChunks(chunks: string[]) {
  // Load in manifest order. Each completed batch is appended after the previous
  // batch, so the catalog never inserts newly arrived products above the user's
  // current position.
  for (const name of chunks) {
    await loadChunk(name);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  updateSnapshot({ isLoading: false });
}

async function loadCatalogProducts() {
  try {
    const basePath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-data/products`;
    const manifestResponse = await fetch(`${basePath}/manifest.json`, { headers: { accept: "application/json" } });
    if (!manifestResponse.ok) throw new Error(`Product catalog manifest failed (${manifestResponse.status}).`);
    manifest = await manifestResponse.json() as CatalogManifest;
    if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) throw new Error("Product catalog manifest is empty.");
    updateSnapshot({ total: manifest.total, totalChunks: manifest.chunks.length, error: null });

    // Only the first batch blocks the initial route. Remaining batches are fetched in the background.
    await loadChunk(manifest.chunks[0]);
    updateSnapshot({ isLoading: manifest.chunks.length > 1 });
    void loadRemainingChunks(manifest.chunks.slice(1)).catch((error) => {
      updateSnapshot({ isLoading: false, error: error instanceof Error ? error.message : "Product catalog loading failed." });
    });
    return products;
  } catch (error) {
    updateSnapshot({ isLoading: false, error: error instanceof Error ? error.message : "Product catalog loading failed." });
    throw error;
  }
}

// Keep the existing synchronous products API for page components, but only wait for the first batch.
export const productsReady = loadCatalogProducts();
await productsReady;

export const categoryLabels: Record<string, string> = {
  clothing: "Clothing",
  shoe: "Shoes",
  pants: "Pants",
  bags: "Bags",
  fragrance: "Fragrance",
  ACC: "Accessories",
  watches: "Watches",
};
export const categoryOrder = ["all", "clothing", "pants", "shoe", "bags", "fragrance", "watches", "ACC"];
