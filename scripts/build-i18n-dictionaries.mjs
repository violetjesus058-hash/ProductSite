// Build client/src/i18n/{locale}.json dictionaries for the RIVORA site i18n layer.
// - Extracts English UI strings from Home.tsx (tx() first args + englishCategoryLabels values).
// - Translates them to 8 locales via MyMemory (free, no key), zh is intentionally excluded.
// - Caches translations in scripts/i18n-cache.json so re-runs only translate new strings.
// Usage: node scripts/build-i18n-dictionaries.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME_TSX = path.join(ROOT, "client/src/pages/Home.tsx");
const OUT_DIR = path.join(ROOT, "client/src/i18n");
const CACHE_FILE = path.join(ROOT, "scripts/i18n-cache.json");
const LOCALES = ["es", "fr", "de", "pt", "ru", "ja", "ko", "ar"];
const CONTACT = "rivora-i18n@example.com"; // raises MyMemory anonymous quota
const DELAY_MS = 300;

function extractStrings() {
  const source = fs.readFileSync(HOME_TSX, "utf8");
  const strings = new Set();
  // tx("ENGLISH", "中文") — first argument
  for (const match of source.matchAll(/\btx\(\s*"((?:[^"\\]|\\.)*)"\s*,/g)) strings.add(match[1]);
  // englishCategoryLabels values
  const labelsMatch = source.match(/const englishCategoryLabels[^=]*=\s*\{([^}]*)\}/);
  if (labelsMatch) for (const pair of labelsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"\s*\]/g)) strings.add(pair[1]);
  return [...strings].filter((value) => value.trim().length > 0);
}

async function translate(text, locale) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${locale}&de=${CONTACT}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status === 503) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const translated = data?.responseData?.translatedText;
      if (typeof translated === "string" && translated.length > 0 && !/^MYMEMORY WARNING/i.test(translated)) return translated;
      throw new Error(data?.responseDetails || "empty translation");
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  return null;
}

async function main() {
  const strings = extractStrings();
  console.log(`Extracted ${strings.length} unique UI strings from Home.tsx`);
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let failures = 0;
  for (const locale of LOCALES) {
    cache[locale] = cache[locale] || {};
    const dictionary = {};
    let pending = 0;
    for (const text of strings) {
      if (typeof cache[locale][text] === "string") { dictionary[text] = cache[locale][text]; continue; }
      pending += 1;
      try {
        const translated = await translate(text, locale);
        dictionary[text] = translated;
        cache[locale][text] = translated;
        process.stdout.write(`  ${locale}: "${text}" -> "${translated}"\n`);
      } catch (error) {
        failures += 1;
        console.warn(`  ${locale}: FAILED "${text}" (${error.message})`);
      }
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
    fs.writeFileSync(path.join(OUT_DIR, `${locale}.json`), JSON.stringify(dictionary, null, 2) + "\n", "utf8");
    console.log(`Wrote ${locale}.json (${Object.keys(dictionary).length} entries, ${pending} newly translated)`);
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  console.log(`Done. Failures: ${failures}. Cache: ${CACHE_FILE}`);
  if (failures > 0) process.exitCode = 2; // re-run resumes from cache
}

main();
