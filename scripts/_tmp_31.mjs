const productId = "7880144513";
const param = JSON.stringify({ itemId: productId, needTranslate: true });
const url = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=${encodeURIComponent(param)}&wdtoken=d7dafeff`;
const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Referer: `https://weidian.com/item.html?itemID=${productId}`,
    Accept: "application/json",
  },
});
const data = await res.json();
const skuInfos = data?.result?.skuInfos || [];
const titles = new Map();
for (const entry of skuInfos) {
  const sku = entry?.skuInfo || {};
  const title = String(sku.title || "").trim();
  const part = title.split(/[;:|]/)[0].trim();
  if (part && !titles.has(part)) titles.set(part, { img: String(sku.img || ""), raw: title });
}
console.log("unique", titles.size);
for (const [part, info] of titles) {
  if (!part.includes("31")) continue;
  console.log(JSON.stringify({ part, codes: [...part].map((ch) => ch.codePointAt(0).toString(16)), img: info.img.slice(-50), raw: info.raw }));
}
console.log("all parts", [...titles.keys()].join(","));
