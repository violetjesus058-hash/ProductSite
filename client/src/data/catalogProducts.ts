import type { Product } from "./products";

export type { Product } from "./products";

export const products: Product[] = [];

async function loadCatalogProducts() {
  const basePath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-data/products`;
  const manifestResponse = await fetch(`${basePath}/manifest.json`, { headers: { accept: "application/json" } });
  if (!manifestResponse.ok) throw new Error(`Product catalog manifest failed (${manifestResponse.status}).`);
  const manifest = await manifestResponse.json() as { total: number; chunks: string[] };
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) throw new Error("Product catalog manifest is empty.");

  const chunks = await Promise.all(manifest.chunks.map(async (name) => {
    const response = await fetch(`${basePath}/${encodeURIComponent(name)}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Product catalog chunk failed (${response.status}): ${name}`);
    return response.json() as Promise<Product[]>;
  }));
  for (const chunk of chunks) products.push(...chunk);
  if (products.length !== manifest.total) throw new Error(`Product catalog is incomplete (${products.length}/${manifest.total}).`);
  return products;
}

// Top-level await keeps the existing synchronous products API for page components, while each
// network asset stays below Cloudflare Pages' 25 MiB per-file limit.
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
