/* Editorial Pinboard reminder: these lightweight browser-local records keep personal catalog actions private, reversible, and visually secondary to the product archive. */

export type HistoryEntry = { id: string; visitedAt: number };
export type EngagementEntry = { id: string; seconds: number; lastViewedAt: number };

const FAVORITES_KEY = "material-catalog:favorites";
const HISTORY_KEY = "material-catalog:history";
const ENGAGEMENT_KEY = "material-catalog:engagement:v1";
const DISLIKES_KEY = "material-catalog:dislikes:v1";

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
export function readDislikes() { return readJson<string[]>(DISLIKES_KEY, []); }
export function saveDislikes(ids: string[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(DISLIKES_KEY, JSON.stringify(ids));
}
export function toggleDislike(id: string, disliked: boolean) {
  const next = disliked ? Array.from(new Set([...readDislikes(), id])) : readDislikes().filter((item) => item !== id);
  saveDislikes(next);
  return next;
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
export function readEngagement() { return readJson<EngagementEntry[]>(ENGAGEMENT_KEY, []); }
export function recordDwellTime(id: string, seconds: number) {
  const safeSeconds = Math.max(0, Math.min(1800, Math.round(seconds)));
  if (!safeSeconds) return readEngagement();
  const current = readEngagement();
  const existing = current.find((entry) => entry.id === id);
  const nextEntry = { id, seconds: Math.min(7200, (existing?.seconds || 0) + safeSeconds), lastViewedAt: Date.now() };
  const next = [nextEntry, ...current.filter((entry) => entry.id !== id)].sort((a, b) => b.lastViewedAt - a.lastViewedAt).slice(0, 80);
  if (typeof window !== "undefined") window.localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(next));
  return next;
}
export function formatVisitTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
