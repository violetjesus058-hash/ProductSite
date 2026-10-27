// Site i18n: default English; auto-switch to the visitor's system language when supported.
// Chinese is intentionally NOT supported — zh system locales fall back to English.
// /admin routes are excluded by the caller (they keep their own hardcoded copy).
import es from "@/i18n/es.json";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import pt from "@/i18n/pt.json";
import ru from "@/i18n/ru.json";
import ja from "@/i18n/ja.json";
import ko from "@/i18n/ko.json";
import ar from "@/i18n/ar.json";

export type SiteLanguage = "en" | "es" | "fr" | "de" | "pt" | "ru" | "ja" | "ko" | "ar";

const STORAGE_KEY = "rivora-lang";
const dictionaries: Record<Exclude<SiteLanguage, "en">, Record<string, string>> = { es, fr, de, pt, ru, ja, ko, ar };
const supported = new Set<string>(["en", ...Object.keys(dictionaries)]);

function normalizeBase(value: string | null | undefined): SiteLanguage | null {
  if (!value) return null;
  const base = value.toLowerCase().split(/[-_]/)[0];
  if (base === "zh") return null; // never render Chinese
  return supported.has(base) ? (base as SiteLanguage) : null;
}

function detect(): SiteLanguage {
  if (typeof window !== "undefined") {
    const fromQuery = normalizeBase(new URLSearchParams(window.location.search).get("lang"));
    if (fromQuery) {
      try { window.localStorage.setItem(STORAGE_KEY, fromQuery); } catch {}
      return fromQuery;
    }
    try {
      const stored = normalizeBase(window.localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch {}
  }
  if (typeof navigator !== "undefined") {
    for (const entry of [...(navigator.languages || []), navigator.language || ""]) {
      const match = normalizeBase(entry);
      if (match) return match;
    }
  }
  return "en";
}

let cached: SiteLanguage | null = null;

export function getSiteLanguage(): SiteLanguage {
  if (!cached) cached = detect();
  return cached;
}

// Third argument kept for call-site compatibility; Chinese copy is never shown.
export function siteText(language: SiteLanguage, english: string, _simplifiedChinese: string): string {
  if (language === "en") return english;
  return dictionaries[language]?.[english] || english;
}
