const hiddenPlatformNames = new Set(["acbuy", "allchinabuy", "mulebuy"]);
const platformIconFiles = {
  acbuy: "ACBuy.png", allchinabuy: "AllChinaBuy.png", bbdbuy: "BBDBuy.png", boonbuy: "BoonBuy.png", cnshopper: "CNShopper.png", cssbuy: "CSSBuy.png", eastmallbuy: "EastMallBuy.png", fishgoo: "FishGoo.png", gtbuy: "GTBuy.png", hipobuy: "Hipobuy.png", hoobuy: "HooBuy.png", hubbuy: "Hubbuy.png", hubbuycn: "Hubbuycn.png", joyagoo: "JoyaGoo.png", kakobuy: "KakoBuy.png", litbuy: "Litbuy.png", loongbuy: "LoongBuy.png", lolobuy: "LoloBuy.png", lovegobuy: "LoveGoBuy.png", mulebuy: "MuleBuy.png", ootdbuy: "OOTDBuy.png", oopbuy: "OopBuy.png", orientdig: "OrientDig.png", ossbuy: "OssBuy.png", pantherbuy: "PantherBuy.png", pikobuy: "PikoBuy.png", ponybuy: "PonyBuy.png", rizzitgo: "RizzitGO.png", spanbuy: "SpanBuy.png", sugargoo: "SugarGoo.png", superbuy: "SuperBuy.png", tigbuy: "TigBuy.png", usfans: "USFans.png", vigorbuy: "VigorBuy.png", weidian: "WeiDian.png", wheebuy: "Wheebuy.png", itaobuy: "iTaoBuy.png", zentbuy: "ZentBuy.png"
};
export function normalizePlatformName(name) { return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
export function platformIconFor(name) { const file = platformIconFiles[normalizePlatformName(name)]; return file ? `/platform-icons/${file}` : ""; }
export function platformSourcesFor(product) {
  const sourceId = String(product.sourceProductId || product.id || "");
  const isKakobuy = /kakobuy\.com/i.test(product.url || "");
  const encodedWeidianUrl = encodeURIComponent(`https://weidian.com/item.html?itemID=${sourceId}`);
  const kakobuyUrl = isKakobuy ? product.url : `https://www.kakobuy.com/item/details?url=${encodedWeidianUrl}&affcode=vxxss`;
  const sourceUrl = `https://shop1784277725.v.weidian.com/item.html?itemID=${sourceId}`;
  const encodedSourceUrl = encodeURIComponent(sourceUrl);
  const sources = [
    { name: "Kakobuy", url: kakobuyUrl, primary: isKakobuy },
    { name: "Superbuy", url: `https://www.superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&url=${encodedWeidianUrl}&partnercode=E6miyW` },
    { name: "RizzitGO", url: `https://rizzitgo.com/detail-page/?goodsId=${sourceId}&source=3` },
    { name: "ZentBuy", url: `https://zentbuy.com/product/weidian/${sourceId}?linkSearch=true` },
    { name: "LoloBuy", url: `https://www.lolobuy.com/productDetail/1791445181801101?url=${sourceUrl}` },
    { name: "PikoBuy", url: `https://www.pikobuy.com/product/detail?productPlatform=WEIDIAN&productUrl=${encodedSourceUrl}` },
    { name: "BoonBuy", url: `https://boonbuy.com/product/weidian/${sourceId}` },
    { name: "LoongBuy", url: `https://loongbuy.com/product-details?url=${sourceUrl}` },
    { name: "Hubbuy", url: `https://hubbuy.com/product/2/${sourceId}` }
  ];
  for (const [name, url] of Object.entries(product.platformLinks || {})) {
    if (!url) continue;
    const key = normalizePlatformName(name);
    const existing = sources.find((source) => normalizePlatformName(source.name) === key);
    if (existing) existing.url = url;
    else sources.push({ name, url });
  }
  if (!isKakobuy && product.url) {
    const fansbuy = sources.find((source) => normalizePlatformName(source.name) === "fansbuy");
    if (fansbuy) { fansbuy.url = product.url; fansbuy.primary = true; }
    else sources.unshift({ name: "Fansbuy", url: product.url, primary: true });
  }
  return sources.filter((source) => !hiddenPlatformNames.has(normalizePlatformName(source.name)));
}
export function primarySourceFor(product) { const sources = platformSourcesFor(product); return sources.find((source) => source.primary) || sources[0]; }
