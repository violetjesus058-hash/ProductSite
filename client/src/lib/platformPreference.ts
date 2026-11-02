const STORAGE_KEY = "rivora-preferred-platform-v1";
const ignoredPlatforms = new Set(["", "all", "allplatforms"]);

function normalizePlatform(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function platformFromSearch(search: string) {
  try {
    const value = new URLSearchParams(search).get("platform") || "";
    const key = normalizePlatform(value);
    return key && !ignoredPlatforms.has(key) ? value.trim() : "";
  } catch {
    return "";
  }
}

/** 记住用户从 ?platform= 入口链接带来的平台选择。 */
export function capturePreferredPlatform(search: string) {
  const value = platformFromSearch(search);
  if (!value) return;
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
}

export function getPreferredPlatform(): string {
  try { return window.localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}

/** 当前 URL 的 platform 参数优先，否则沿用记住的入口选择。 */
export function resolvePreferredPlatform(search: string): string {
  return platformFromSearch(search) || getPreferredPlatform();
}
