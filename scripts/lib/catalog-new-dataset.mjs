// catalog-new.csv 读取与 id 对齐（/spreadsheet1 数据集专用）
//
// CSV 里 `url` / `sourceProductId` 可能是旧商品 id，`new link` 列才是最新链接。
// 本模块把它的内层 Weidian itemID 作为目标 id，链式指向会一路收敛到链尾，
// 收敛后同一链尾的多个旧商品会合并，并按款式字段去重（只保留一份）。
// 多批 CSV 汇总时，后一批与前一批完全相同的款式行会被丢弃，同一批内的重复行保持不变。
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

function parseRecords(csvText) {
  const table = parseCsvRows(String(csvText).replace(/^\ufeff/, ""));
  const header = table.shift().map((value) => value.trim());
  return table.map((values) => {
    const record = {};
    header.forEach((key, index) => { record[key] = String(values[index] ?? "").trim(); });
    return record;
  });
}

// 判重只看款式名与尺码：同一款式在不同批次抓取时价格会有几分钱汇率差，
// 图片列表也可能多一张/少一张，都不能当成不同款式
const styleKeyOf = (record) => [record.sourceProductId, record.styleLabel, record.sizes].join("\u0001");

export function prepareCatalogNewDatasets(csvTexts) {
  const groups = csvTexts.map(parseRecords);
  const allRecords = groups.flat();

  // 商品级 new link：同一商品的多行指向一致，取第一个非空值（跨批次按文件顺序）
  const nextIdByProduct = new Map();
  for (const record of allRecords) {
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

  for (const record of allRecords) {
    record.__oldId = record.sourceProductId;
    const target = targetIdByProduct.get(record.sourceProductId);
    if (!target) continue;
    record.sourceProductId = target;
    if (/^kb-\d+/.test(record.id)) record.id = record.id.replace(/^kb-\d+/, `kb-${target}`);
    record.shopUrl = weidianLink(target);
    record.url = kakobuyLink(target);
    if (record["new link"]) record["new link"] = record.url;
  }

  const rows = [];
  const seenInMerged = new Set();
  const seenInEarlierFiles = new Set();
  let dedupedRows = 0;
  let crossFileDuplicates = 0;
  for (const group of groups) {
    const fileKeys = new Set();
    for (const record of group) {
      const key = styleKeyOf(record);
      const isMerged = mergedTargets.has(record.sourceProductId);
      if (isMerged && seenInMerged.has(key)) { dedupedRows += 1; continue; }
      if (!fileKeys.has(key) && seenInEarlierFiles.has(key)) { crossFileDuplicates += 1; continue; }
      rows.push(record);
      fileKeys.add(key);
      if (isMerged) seenInMerged.add(key);
    }
    for (const key of fileKeys) seenInEarlierFiles.add(key);
  }

  // 链式指向有时会把两件不同商品串到同一个 id 上（分类不同、款式完全不重叠）。
  // 这类合并只保留行数最多的分类，其余分类回退到各自旧 id，避免详情页混进别的商品。
  const categoriesByProduct = new Map();
  for (const record of rows) {
    if (!categoriesByProduct.has(record.sourceProductId)) categoriesByProduct.set(record.sourceProductId, new Map());
    const byCategory = categoriesByProduct.get(record.sourceProductId);
    byCategory.set(record.category, (byCategory.get(record.category) || 0) + 1);
  }
  const splitOff = [];
  for (const [productId, byCategory] of categoriesByProduct) {
    if (byCategory.size < 2) continue;
    const keepCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const record of rows) {
      if (record.sourceProductId !== productId || record.category === keepCategory) continue;
      const oldId = record.__oldId || productId;
      record.sourceProductId = oldId;
      if (/^kb-\d+/.test(record.id)) record.id = record.id.replace(/^kb-\d+/, `kb-${oldId}`);
      record.shopUrl = weidianLink(oldId);
      record.url = kakobuyLink(oldId);
      if (record["new link"]) record["new link"] = record.url;
      splitOff.push({ target: productId, keptCategory: keepCategory, oldId, category: record.category });
    }
  }

  for (const record of rows) {
    delete record.__oldId;
    // 极少数行源数据没有款式字段，给个中性英文标签，避免前端 STYLE 区出现空白。
    if (!String(record.styleLabel || "").trim()) record.styleLabel = "Standard";
  }

  const stats = {
    rowsIn: allRecords.length,
    rowsOut: rows.length,
    productsIn: nextIdByProduct.size,
    productsOut: new Set(rows.map((record) => record.sourceProductId)).size,
    rekeyedProducts: targetIdByProduct.size,
    mergedTargets: [...mergedTargets],
    dedupedRows,
    crossFileDuplicates,
    splitOff,
    emptyNewLinkProducts: [...nextIdByProduct.entries()].filter(([, nextId]) => !nextId).map(([oldId]) => oldId),
  };

  return { rows, stats };
}

// 源 CSV 由 GBK/GB18030 编码导出，直接按 UTF-8 读会把中文整段变成 U+FFFD 乱码，
// 前端就会渲染成豆腐块。检测到替换字符时改用 GB18030 重新解码。
function decodeCsv(buffer) {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\ufffd")) return utf8;
  try {
    return new TextDecoder("gb18030").decode(buffer);
  } catch {
    return utf8;
  }
}

export function readCatalogNewDatasets(csvPaths) {
  return prepareCatalogNewDatasets(csvPaths.map((csvPath) => decodeCsv(fs.readFileSync(csvPath))));
}
