export const LONG_SLEEVE_CATEGORY = "long-sleeve";
const longSleevePattern = /\blong[\s-]*sleeves?\b/i;
const shortSleevePattern = /\bshort[\s-]*sleeves?\b/i;
export function isLongSleeve(item) {
  const name = String(item.name || "");
  const classification = `${name} ${item.subCategory || ""}`;
  return String(item.category || "").trim().toLowerCase() === "clothing"
    && !shortSleevePattern.test(name)
    && longSleevePattern.test(classification);
}
export function curatedPriority(item) {
  const category = String(item.category || "").trim().toLowerCase();
  if (category === "shoe") return 0;
  if (isLongSleeve(item)) return 1;
  if (category === "pants") return 2;
  return 3;
}
