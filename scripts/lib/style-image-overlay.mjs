// 把 weidian thor SKU 图叠加到 catalog-new 的行上。
// 每行的首图替换成该款式自己的 SKU 图，索引的 thumbnail / hasStyleImage 与详情页的
// styles[].images 都随之生效；没有抓到的行保持原样，不影响构建。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(__dirname, "style-images-1.json");

let cachedMap = null;

export function loadStyleImageMap() {
  if (cachedMap) return cachedMap;
  if (!fs.existsSync(MAP_PATH)) {
    cachedMap = {};
    return cachedMap;
  }
  cachedMap = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
  return cachedMap;
}

const splitImages = (value) =>
  String(value || "")
    .split(/[|;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export function applyStyleImages(rows) {
  const map = loadStyleImageMap();
  const touchedProducts = new Set();
  let applied = 0;
  for (const row of rows) {
    const productId = String(row.sourceProductId || row.id || "").trim();
    const styleKey = String(row.styleKey || "").trim();
    const image = (map[productId] || {})[styleKey];
    if (!image) continue;
    const images = splitImages(row.images);
    if (images[0] === image) continue;
    const rest = images.filter((entry) => entry !== image);
    row.images = [image, ...rest].join("|");
    applied += 1;
    touchedProducts.add(productId);
  }
  return { applied, products: touchedProducts.size };
}
