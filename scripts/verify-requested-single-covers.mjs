import fs from "node:fs";
const source = fs.readFileSync("client/src/data/products.ts", "utf8");
const start = source.indexOf("export const products: Product[] = [") + "export const products: Product[] = ".length;
const end = source.indexOf("] as Product[];", start) + 1;
const products = JSON.parse(source.slice(start, end));
const ids = ["kb-7576679472-15-91", "kb-7545224884-13-12", "kb-7601684029-23-47", "kb-7576564461-27-97", "kb-7576574207-27-97", "kb-7574761499-13-12", "kb-7576609763-42-43", "kb-7771386520-24-35", "kb-7545254650-48-60", "kb-7543424263-112-24", "kb-7578440914-112-24", "kb-7611885929-112-24"];
for (const id of ids) {
  const p = products.find((item) => item.id === id);
  console.log(JSON.stringify(p ? { id: p.id, sourceProductId: p.sourceProductId, name: p.name, price: p.price, firstImage: p.images[0], imageCount: p.images.length } : { id, missing: true }));
}
