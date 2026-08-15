/* Editorial Pinboard reminder: these lightweight browser-local records keep personal catalog actions private, reversible, and visually secondary to the product archive. */

export type HistoryEntry = { id: string; visitedAt: number };

const FAVORITES_KEY = "material-catalog:favorites";
const HISTORY_KEY = "material-catalog:history";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readFavorites() { return readJson<string[]>(FAVORITES_KEY, []); }
export function saveFavorites(ids: string[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}
export function readHistory() { return readJson<HistoryEntry[]>(HISTORY_KEY, []); }
export function saveHistory(entries: HistoryEntry[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}
export function rememberVisit(id: string) {
  const next = [{ id, visitedAt: Date.now() }, ...readHistory().filter((entry) => entry.id !== id)].slice(0, 24);
  saveHistory(next);
  return next;
}
export function formatVisitTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
