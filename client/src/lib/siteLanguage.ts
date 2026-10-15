export type SiteLanguage = "en" | "zh";

export function getSiteLanguage(): SiteLanguage {
  if (typeof navigator === "undefined") return "en";
  const languages = [...(navigator.languages || []), navigator.language || ""];
  return languages.some((value) => /^zh(?:[-_]|$)/i.test(value)) ? "zh" : "en";
}

export function siteText(language: SiteLanguage, english: string, simplifiedChinese: string) {
  return language === "zh" ? simplifiedChinese : english;
}
