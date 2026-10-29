#!/usr/bin/env node
/**
 * 分批导入商品 CSV 到 sites Worker 的 /api/admin/products/import
 *
 * 用法：
 *   node scripts/import-catalog-csv.mjs <csv路径> --worker <Worker地址> --key <ADMIN_API_KEY> [选项]
 *
 * 选项：
 *   --dry-run      只做校验（commit=false），不写 D1
 *   --batch-bytes  N  单批字节上限，默认 2400000（Worker 硬上限 3000000）
 *   --reset        清空进度文件，从头开始
 *   --delay        批间隔毫秒，默认 600
 *
 * 环境变量也可提供：WORKER_URL / ADMIN_API_KEY
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// 与 cloudflare-worker/src/index.ts 的 productTemplateHeaders 保持一致
const TEMPLATE_HEADERS = [
  "id", "sourceProductId", "name", "catalogName", "category", "subCategory", "brand",
  "price", "referencePrice", "currency", "description", "sizes", "colors", "stock",
  "shop", "shopUrl", "url", "images", "tags", "collectedAt", "reviewStatus", "reviewNote",
  "platformLinks",
];

const WORKER_LIMITS = { maxRows: 5000, maxBytes: 3_000_000 };
const PROGRESS_FILE = path.join(process.cwd(), "import-progress.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && n === "\n") i += 1;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [rawHead, ...data] = rows;
  const head = (rawHead || []).map((v) => v.trim().replace(/^\ufeff/, ""));
  return data.map((values) => Object.fromEntries(head.map((key, i) => [key, values[i] ?? ""])));
}

/** 只保留 Worker 认识的字段，多余列（sourceSkuIds / priceRmb / 新链接 等）丢弃以压缩体积 */
function pickTemplateColumns(records) {
  return records.map((record) => {
    const picked = {};
    for (const key of TEMPLATE_HEADERS) picked[key] = String(record[key] ?? "");
    return picked;
  });
}

function byteLen(value) {
  return Buffer.byteLength(value, "utf8");
}

function packBatches(rows, byteLimit) {
  const batches = [];
  let current = [];
  let currentBytes = 2; // "[]"
  for (const row of rows) {
    const rowBytes = byteLen(JSON.stringify(row)) + 1; // 逗号
    const exceedBytes = currentBytes + rowBytes > byteLimit;
    const exceedRows = current.length >= WORKER_LIMITS.maxRows;
    if (current.length && (exceedBytes || exceedRows)) {
      batches.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += rowBytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

function loadProgress(file, totalRows) {
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved && saved.totalRows === totalRows && Array.isArray(saved.done)) return saved;
  } catch { /* 无进度文件 */ }
  return { totalRows, done: [] };
}

function saveProgress(file, progress) {
  fs.writeFileSync(file, JSON.stringify(progress, null, 2), "utf8");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callImport(workerUrl, key, rows, commit) {
  const body = JSON.stringify({ rows, commit });
  const res = await fetch(`${workerUrl}/api/admin/products/import`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-api-key": key },
    body,
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, payload, bodyBytes: byteLen(body) };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const opt = (name, fallback) => {
    const idx = args.indexOf(name);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
  };
  const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--dry-run", "--reset"].includes(args[i - 1])));
  const csvPath = positional[0];
  const workerUrl = String(opt("--worker", process.env.WORKER_URL || "")).replace(/\/$/, "");
  const adminKey = String(opt("--key", process.env.ADMIN_API_KEY || ""));
  const byteLimit = Number(opt("--batch-bytes", 2_400_000));
  const delayMs = Number(opt("--delay", 600));
  const dryRun = flag("--dry-run");

  if (!csvPath || !workerUrl || !adminKey) {
    console.error("缺少参数。用法：node scripts/import-catalog-csv.mjs <csv路径> --worker <URL> --key <ADMIN_API_KEY>");
    console.error("也可用环境变量 WORKER_URL / ADMIN_API_KEY。");
    process.exit(1);
  }
  if (byteLimit > WORKER_LIMITS.maxBytes - 100_000) {
    console.error(`--batch-bytes 过大：Worker 上限 ${WORKER_LIMITS.maxBytes} 字节，请留余量（建议 ≤ 2400000）。`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const records = parseCsv(raw);
  const rows = pickTemplateColumns(records);
  if (!rows.length) { console.error("CSV 没有数据行。"); process.exit(1); }

  const batches = packBatches(rows, byteLimit);
  const progressPath = path.join(path.dirname(path.resolve(csvPath)), "import-progress.json");
  if (flag("--reset") && fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
  const progress = loadProgress(progressPath, rows.length);

  console.log("==== 分批导入 ====");
  console.log(`CSV       : ${csvPath}`);
  console.log(`总行数    : ${rows.length}`);
  console.log(`总批次    : ${batches.length}`);
  console.log(`单批上限  : ${byteLimit} 字节 / ${WORKER_LIMITS.maxRows} 行`);
  console.log(`Worker    : ${workerUrl}`);
  console.log(`模式      : ${dryRun ? "只校验 (dry-run)" : "校验 + 写入"}`);
  if (progress.done.length) console.log(`已续传 : 跳过批次 ${progress.done.map((i) => i + 1).join(", ")}`);
  console.log("");

  if (flag("--plan-only")) {
    batches.forEach((batch, i) => {
      const bytes = byteLen(JSON.stringify({ rows: batch, commit: true }));
      console.log(`批次 ${i + 1}: ${batch.length} 行, 请求体 ${(bytes / 1024).toFixed(0)}KB, 首行 ${batch[0].id}`);
    });
    console.log(`\n合计 ${rows.length} 行 / ${batches.length} 批，最大批 ${Math.max(...batches.map((b) => byteLen(JSON.stringify({ rows: b, commit: true }))))} 字节（上限 ${WORKER_LIMITS.maxBytes}）。`);
    return;
  }

  // 阶段一：全量校验
  console.log("---- 阶段一：校验 ----");
  let totalInvalid = 0;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const result = await callImport(workerUrl, adminKey, batch, false);
    if (!result.ok) {
      console.error(`批次 ${i + 1} 校验失败：HTTP ${result.status} ${result.payload.error || ""}`);
      process.exit(1);
    }
    const invalid = result.payload.invalid || [];
    totalInvalid += invalid.length;
    console.log(`批次 ${i + 1}/${batches.length}: ${batch.length} 行, 体积 ${(result.bodyBytes / 1024).toFixed(0)}KB, 有效 ${result.payload.valid}, 无效 ${invalid.length}`);
    for (const item of invalid.slice(0, 5)) console.log(`   第 ${item.row} 行：${item.error}`);
    await sleep(delayMs);
  }
  if (totalInvalid > 0) {
    console.error(`\n共 ${totalInvalid} 行无效，已停止，未写入任何数据。`);
    process.exit(1);
  }
  console.log("校验全部通过。\n");
  if (dryRun) { console.log("dry-run 结束，未写入。"); return; }

  // 阶段二：逐批写入
  console.log("---- 阶段二：写入 ----");
  let imported = 0;
  for (let i = 0; i < batches.length; i += 1) {
    if (progress.done.includes(i)) { console.log(`批次 ${i + 1}/${batches.length}: 已完成，跳过`); continue; }
    const batch = batches[i];
    const result = await callImport(workerUrl, adminKey, batch, true);
    if (!result.ok) {
      console.error(`批次 ${i + 1} 写入失败：HTTP ${result.status} ${result.payload.error || ""}`);
      console.error("进度已保存，修复后用同一命令重跑即可续传。");
      saveProgress(progressPath, progress);
      process.exit(1);
    }
    imported += result.payload.imported || 0;
    progress.done.push(i);
    saveProgress(progressPath, progress);
    console.log(`批次 ${i + 1}/${batches.length}: 写入 ${result.payload.imported} 行 (累计 ${imported})`);
    await sleep(delayMs);
  }
  console.log("");
  console.log(`完成：共写入 ${imported} 行。Worker 已自动清理 KV 覆盖缓存，前端下次加载即生效。`);
  console.log(`进度文件：${progressPath}（如需从头重跑，加 --reset）`);
}

main().catch((error) => {
  console.error("执行异常：", error instanceof Error ? error.message : error);
  process.exit(1);
});
