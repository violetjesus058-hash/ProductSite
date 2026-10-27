// Build/refresh client/src/data/style-images.ts via the Weidian internal thor API.
// Replaces build-style-image-map.py — Weidian is now an SPA so HTML scraping no longer works.
// The thor endpoint returns the same skuInfos payload the front-end consumes; no login needed.
//
// Usage:
//   node scripts/build-style-image-map-v2.mjs                # process every entry in style-image-missing.json
//   node scripts/build-style-image-map-v2.mjs --only <id,id> # restrict to specific sourceIds
//   node scripts/build-style-image-map-v2.mjs --dry-run      # fetch + report but do not write the .ts file
//
// Rate limit: conservative on purpose — weidian blocks IPs that hammer thor.weidian.com.
// Default is 2 concurrent requests with 1–3s jitter between each, plus auto back-off on 429/5xx.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MISSING_JSON = path.join(ROOT, "scripts", "style-image-missing.json");
const OUTPUT_TS = path.join(ROOT, "client", "src", "data", "style-images.ts");

const API_URL = "https://thor.weidian.com/detail/getItemSkuInfo/1.0";
// Public anonymous token weidian.com itself ships to every visitor. If it ever expires,
// open any weidian item page in a browser, F12 → Network → copy the `wdtoken` query param.
const WD_TOKEN = "d7dafeff";
const TIMEOUT_MS = 20000;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)) : null;
const concIdx = args.indexOf("--concurrency");
const CONCURRENCY = concIdx >= 0 ? Math.max(1, parseInt(args[concIdx + 1], 10) || 1) : 2;
const retryIdx = args.indexOf("--retries");
const RETRIES = retryIdx >= 0 ? Math.max(0, parseInt(args[retryIdx + 1], 10) || 0) : 3;

// Global state: back-off timer shared across workers. If any request hits 429/5xx we pause everyone.
let globalPauseUntil = 0;
const MIN_INTERVAL_MS = 1000; // minimum spacing between requests (enforced per-worker)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function normalizeKey(s) {
  return String(s || "").trim().toLowerCase();
}
function collapseWs(s) {
  return normalizeKey(s).replace(/\s+/g, "");
}

function loadExisting() {
  if (!fs.existsSync(OUTPUT_TS)) return {};
  const text = fs.readFileSync(OUTPUT_TS, "utf8");
  const openIdx = text.indexOf("= ");
  const closeIdx = text.indexOf(" as const;", openIdx);
  if (openIdx < 0 || closeIdx < 0) throw new Error("Could not parse existing style-images.ts");
  return JSON.parse(text.slice(openIdx + 2, closeIdx));
}

async function fetchSkuInfos(sourceId) {
  const param = JSON.stringify({ itemId: sourceId, needTranslate: true });
  const url = `${API_URL}?param=${encodeURIComponent(param)}&wdtoken=${WD_TOKEN}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Referer: `https://weidian.com/item.html?itemID=${sourceId}`,
    Accept: "application/json",
  };

  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    // Honor global pause (back-off from 429/5xx)
    const now = Date.now();
    if (now < globalPauseUntil) await sleep(globalPauseUntil - now);

    // Per-request jitter so workers don't lockstep
    await sleep(jitter(200, 800));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers });
      const elapsed = Date.now() - started;

      if (res.status === 429 || res.status >= 500) {
        // Rate limited or server error — global back-off 10s + attempt jitter
        globalPauseUntil = Date.now() + 10_000 + attempt * 5_000;
        console.warn(`  [429/5xx on ${sourceId}] pausing all workers ${10 + attempt * 5}s (attempt ${attempt + 1}/${RETRIES + 1})`);
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const skuInfos = data?.result?.skuInfos;
      if (!Array.isArray(skuInfos)) throw new Error(`Bad payload (status=${JSON.stringify(data?.status)})`);
      return skuInfos;
    } catch (err) {
      lastErr = err;
      // Connection-level failure (IP ban) — longer pause
      const isConnErr = err?.name === "TypeError" || err?.message?.includes("fetch failed");
      const backOff = isConnErr ? 15_000 + attempt * 10_000 : 2_000 * (attempt + 1);
      if (attempt < RETRIES) {
        console.warn(`  [retry ${attempt + 1}/${RETRIES} on ${sourceId}] ${err?.message || err} — backoff ${Math.round(backOff / 1000)}s`);
        await sleep(backOff);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function buildApiStyleMap(skuInfos) {
  const map = new Map();
  for (const entry of skuInfos) {
    const sku = entry?.skuInfo || {};
    const title = String(sku.title || "");
    const img = String(sku.img || "");
    if (!title || !img) continue;
    const stylePart = title.split(/[;:|]/)[0];
    const k1 = normalizeKey(stylePart);
    const k2 = collapseWs(stylePart);
    if (k1 && !map.has(k1)) map.set(k1, img);
    if (k2 && k2 !== k1 && !map.has(k2)) map.set(k2, img);
  }
  return map;
}

async function processOne(sourceId, missingStyles) {
  const skuInfos = await fetchSkuInfos(sourceId);
  const apiMap = buildApiStyleMap(skuInfos);
  const out = {};
  if (missingStyles.length === 0) {
    for (const [k, img] of apiMap) {
      if (!k || k !== normalizeKey(k)) continue;
      out[k] = img;
    }
  } else {
    for (const style of missingStyles) {
      const wantExact = normalizeKey(style);
      const wantCollapsed = collapseWs(style);
      const img = apiMap.get(wantExact) || apiMap.get(wantCollapsed);
      if (img) out[wantExact] = img;
    }
  }
  return out;
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  let completed = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async (laneIdx) => {
    // Stagger each worker so they don't all fire at t=0
    await sleep(laneIdx * jitter(500, 1500));
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i]) };
      } catch (err) {
        results[i] = { ok: false, error: err };
      }
      completed++;
      if (completed % 10 === 0 || completed === items.length) {
        console.log(`[${completed}/${items.length}]`);
      }
    }
  });
  await Promise.all(lanes);
  return results;
}

async function main() {
  const missing = JSON.parse(fs.readFileSync(MISSING_JSON, "utf8"));
  const existing = loadExisting();

  const queue = [];
  for (const [sourceId, styles] of Object.entries(missing)) {
    if (ONLY && !ONLY.has(sourceId)) continue;
    const have = existing[sourceId] || {};
    const needed = styles.filter((s) => !have[normalizeKey(s)]);
    if (styles.length > 0 && needed.length === 0) continue;
    queue.push([sourceId, needed.length ? needed : styles]);
  }

  console.log(`Existing sources: ${Object.keys(existing).length}`);
  console.log(`Sources to fetch: ${queue.length}  (concurrency=${CONCURRENCY}, retries=${RETRIES})`);
  if (queue.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const results = await runPool(queue, async ([sourceId, styles]) => {
    const mapping = await processOne(sourceId, styles);
    return [sourceId, mapping];
  }, CONCURRENCY);

  const failures = [];
  let sourcesUpdated = 0;
  let stylesAdded = 0;
  let stylesStillMissing = 0;
  for (let i = 0; i < queue.length; i++) {
    const [sourceId, requestedStyles] = queue[i];
    const r = results[i];
    if (!r) continue;
    if (!r.ok) {
      failures.push(`${sourceId}: ${r.error?.message || r.error}`);
      continue;
    }
    const [, mapping] = r.value;
    if (!existing[sourceId]) existing[sourceId] = {};
    const before = Object.keys(existing[sourceId]).length;
    Object.assign(existing[sourceId], mapping);
    const after = Object.keys(existing[sourceId]).length;
    if (after > before) sourcesUpdated++;
    stylesAdded += after - before;
    stylesStillMissing += Math.max(0, requestedStyles.length - Object.keys(mapping).length);
  }

  console.log(`\n=== Result ===`);
  console.log(`Sources updated: ${sourcesUpdated}`);
  console.log(`Style images added: ${stylesAdded}`);
  console.log(`Styles still unresolved (API didn't have them): ${stylesStillMissing}`);
  if (failures.length) {
    console.log(`Fetch failures: ${failures.length}`);
    failures.slice(0, 20).forEach((f) => console.log("  " + f));
  }

  if (DRY_RUN) {
    console.log("Dry run — not writing style-images.ts");
    return;
  }

  const header =
    "// Generated by scripts/build-style-image-map-v2.mjs; images come from the Weidian thor getItemSkuInfo API.\n";
  const body =
    header +
    "export const styleImages: Record<string, Record<string, string>> = " +
    JSON.stringify(existing, null, 2) +
    " as const;\n";
  fs.writeFileSync(OUTPUT_TS, body, "utf8");
  console.log(
    `Wrote ${OUTPUT_TS}: ${Object.keys(existing).length} sources, ${Object.values(existing).reduce(
      (a, v) => a + Object.keys(v).length,
      0
    )} total style entries`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
