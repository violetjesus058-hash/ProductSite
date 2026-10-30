// catalog-new.csv 读取与 id 对齐（/spreadsheet1 数据集专用）
//
// CSV 里 `url` / `sourceProductId` 可能是旧商品 id，`new link` 列才是最新链接。
// 本模块把它的内层 Weidian itemID 作为目标 id，链式指向会一路收敛到链尾，
// 收敛后同一链尾的多个旧商品会合并，并按款式字段去重（只保留一份）。
import fs from "node:fs";

export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((values) => values.length > 1 && values.join("").trim());
}

export const weidianLink = (id) => `https://weidian.com/item.html?itemID=${id}`;
export const kakobuyLink = (id) =>
  `https://www.kakobuy.com/item/details?url=${encodeURIComponent(weidianLink(id))}&affcode=vxxss`;

export function extractInnerItemId(link) {
  const raw = String(link || "").trim();
  if (!raw) return "";
  try {
    const inner = new URL(raw).searchParams.get("url");
    if (!inner) return "";
    const itemId = new URL(decodeURIComponent(inner)).searchParams.get("itemID");
    return itemId && /^\d+$/.test(itemId) ? itemId : "";
  } catch {
    return "";
  }
}

export function prepareCatalogNewDataset(csvText) {
  const table = parseCsvRows(String(csvText).replace(/^\ufeff/, ""));
  const header = table.shift().map((value) => value.trim());
  const records = table.map((values) => {
    const record = {};
    header.forEach((key, index) => { record[key] = String(values[index] ?? "").trim(); });
    return record;
  });

  // 商品级 new link：同一商品的多行指向一致，取第一个非空值
  const nextIdByProduct = new Map();
  for (const record of records) {
    const oldId = record.sourceProductId;
    if (!nextIdByProduct.has(oldId)) nextIdByProduct.set(oldId, "");
    if (!nextIdByProduct.get(oldId)) {
      const nextId = extractInnerItemId(record["new link"]);
      if (nextId) nextIdByProduct.set(oldId, nextId);
    }
  }

  // 链式指向收敛到链尾（最多看 8 跳，避免数据异常时死循环）
  const resolveId = (oldId) => {
    let current = oldId;
    const seen = new Set([oldId]);
    for (let hop = 0; hop < 8; hop += 1) {
      const nextId = nextIdByProduct.get(current);
      if (!nextId || seen.has(nextId)) break;
      seen.add(nextId);
      current = nextId;
    }
    return current;
  };

  const targetIdByProduct = new Map();
  for (const oldId of nextIdByProduct.keys()) {
    const target = resolveId(oldId);
    if (target !== oldId) targetIdByProduct.set(oldId, target);
  }

  const originsByTarget = new Map();
  for (const [oldId, target] of targetIdByProduct) {
    if (!originsByTarget.has(target)) originsByTarget.set(target, []);
    originsByTarget.get(target).push(oldId);
  }
  const mergedTargets = new Set(
    [...originsByTarget.entries()].filter(([, origins]) => origins.length > 1).map(([target]) => target),
  );

  for (const record of records) {
    const target = targetIdByProduct.get(record.sourceProductId);
    if (!target) continue;
    record.sourceProductId = target;
    if (/^kb-\d+/.test(record.id)) record.id = record.id.replace(/^kb-\d+/, `kb-${target}`);
    record.shopUrl = weidianLink(target);
    record.url = kakobuyLink(target);
    if (record["new link"]) record["new link"] = record.url;
  }

  // 合并后的商品内部会有一模一样的两套款式，按款式字段去重
  const seen = new Set();
  const rows = records.filter((record) => {
    if (!mergedTargets.has(record.sourceProductId)) return true;
    const key = [record.sourceProductId, record.styleLabel, record.sizes, record.images, record.price].join("\u0001");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const stats = {
    rowsIn: records.length,
    rowsOut: rows.length,
    productsIn: nextIdByProduct.size,
    productsOut: new Set(rows.map((record) => record.sourceProductId)).size,
    rekeyedProducts: targetIdByProduct.size,
    mergedTargets: [...mergedTargets],
    dedupedRows: records.length - rows.length,
    emptyNewLinkProducts: [...nextIdByProduct.entries()].filter(([, nextId]) => !nextId).map(([oldId]) => oldId),
  };

  return { header, rows, stats };
}

export function readCatalogNewDataset(csvPath) {
  return prepareCatalogNewDataset(fs.readFileSync(csvPath, "utf8"));
}
