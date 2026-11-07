const hiddenPlatformNames = new Set(["acbuy", "allchinabuy", "mulebuy"]);
const platformAliases = { joyabuy: "joyagoo", hubbuy: "hubbuycn" };
const platformIconFiles = {
  acbuy: "ACBuy.png",
  allchinabuy: "AllChinaBuy.png",
  anovabuy: "AnovaBuy.png",
  bbdbuy: "BBDBuy.png",
  bbdbuyeu: "BBDBuy.png",
  boonbuy: "BoonBuy.png",
  cnshopper: "CNShopper.png",
  cssbuy: "CSSBuy.png",
  didpop: "Didpop.png",
  eastmallbuy: "EastMallBuy.png",
  esgobuy: "ESGOBuy.png",
  fishgoo: "FishGoo.png",
  fansbuy: "Fansbuy.png",
  gtbuy: "GTBuy.png",
  hipobuy: "Hipobuy.png",
  hoobuy: "HooBuy.png",
  hubbuy: "Hubbuycn.png",
  hubbuycn: "Hubbuycn.png",
  joyabuy: "JoyaGoo.png",
  joyagoo: "JoyaGoo.png",
  kakobuy: "KakoBuy.png",
  litbuy: "Litbuy.png",
  loongbuy: "LoongBuy.png",
  lolobuy: "LoloBuy.png",
  lovegobuy: "LoveGoBuy.png",
  mycnbox: "MyCNBox.png",
  mulebuy: "MuleBuy.png",
  ootdbuy: "OOTDBuy.png",
  oopbuy: "OopBuy.png",
  orientdig: "OrientDig.png",
  okeyhaul: "Okeyhaul.png",
  ossbuy: "OssBuy.png",
  pantherbuy: "PantherBuy.png",
  pikobuy: "PikoBuy.png",
  ponybuy: "PonyBuy.png",
  rizzitgo: "RizzitGO.png",
  spanbuy: "SpanBuy.png",
  sugargoo: "SugarGoo.png",
  superbuy: "SuperBuy.png",
  tigbuy: "TigBuy.png",
  usfans: "USFans.png",
  uufans: "UUFans.png",
  vigorbuy: "VigorBuy.png",
  weidian: "WeiDian.png",
  wheebuy: "Wheebuy.png",
  itaobuy: "iTaoBuy.png",
  zentbuy: "ZentBuy.png",
};

// 补充邀请码（平台链接规则本身未内嵌推广参数的平台）
const spreadsheetInviteCodes = {
  joyagoo: { param: "ref", code: "300950678" },
  cssbuy: { param: "promotionCode", code: "141b285ac4016ebb" },
  itaobuy: { param: "inviteCode", code: "FHBPH2RW" },
  bbdbuy: { param: "inviteCode", code: "j4zwj7" },
};

function appendInviteCode(url, { param, code }) {
  if (!url || !code || url.includes(`${param}=`)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${param}=${code}`;
}

export function normalizePlatformName(name) {
  const normalized = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return platformAliases[normalized] || normalized;
}

export function platformIconFor(name) {
  const file = platformIconFiles[normalizePlatformName(name)];
  return file ? `/platform-icons/${file}` : "";
}

export function platformSourcesFor(product, options = {}) {
  const sourceId = String(product.sourceProductId || product.id || "");
  // 主站商品统一使用批量替换后的商品 id（linkTargetId），所有平台按各自规则拼接并带上邀请码；
  // /spreadsheet 数据集没有该字段，自动回退原始商品 id，数据保持不动。
  const targetId = String(product.linkTargetId || sourceId);
  const encodedId = encodeURIComponent(targetId);
  const isKakobuy = /kakobuy\.com/i.test(product.url || "");
  const encodedWeidianUrl = encodeURIComponent(`https://weidian.com/item.html?itemID=${targetId}`);
  const sourceUrl = `https://shop1784277725.v.weidian.com/item.html?itemID=${targetId}`;
  const encodedSourceUrl = encodeURIComponent(sourceUrl);
  // Kakobuy 链接统一按当前最新的商品 id 生成，不使用 CSV 中可能已过期的 url
  const kakobuyUrl = `https://www.kakobuy.com/item/details?url=${encodedWeidianUrl}&affcode=vxxss`;
  const sources = [
    { name: "Oopbuy", url: `https://oopbuy.com/product/weidian/${encodedId}?inviteCode=Y5DH4UF2W`, primary: true },
    { name: "Kakobuy", url: kakobuyUrl },
    { name: "Superbuy", url: `https://www.superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&url=${encodedWeidianUrl}&partnercode=E6miyW` },
    { name: "RizzitGO", url: `https://rizzitgo.com/detail-page/?goodsId=${encodedId}&source=3` },
    { name: "ZentBuy", url: `https://zentbuy.com/product/weidian/${encodedId}?linkSearch=true` },
    { name: "LoloBuy", url: `https://www.lolobuy.com/productDetail/1791445181801101?url=${sourceUrl}` },
    { name: "PikoBuy", url: `https://www.pikobuy.com/product/detail?productPlatform=WEIDIAN&productUrl=${encodedSourceUrl}` },
    { name: "BoonBuy", url: `https://boonbuy.com/product/weidian/${encodedId}` },
    { name: "LoongBuy", url: `https://loongbuy.com/product-details?url=${sourceUrl}` },
    { name: "HubbuyCN", url: `https://www.hubbuy.com/product/2/${encodedId}` },
    { name: "Joyagoo", url: `https://joyagoo.com/product?id=${encodedId}&platform=WEIDIAN&productUrl=&productPwd=` },
    { name: "EastMallBuy", url: `https://eastmallbuy.com/web/#/item/index?tp=1688&tid=&searchlang=en&url=${encodedSourceUrl}&inviter=valeriyachentsov` },
    { name: "Okeyhaul", url: `https://www.okeyhaul.com/mall/detail?sourceUrl=true&spuid=${encodedId}` },
    { name: "PonyBuy", url: `https://www.ponybuy.com/products/3/${encodedId}` },
    { name: "CSSBuy", url: `https://www.cssbuy.com/shop/goodsDetail?type=weidian&id=${encodedId}` },
    { name: "AnovaBuy", url: `https://anovabuy.com/product/${encodedId}?from=search&ecom=3` },
    { name: "MyCNBox", url: `https://mycnbox.com/goodsDetail?mallType=weidian&itemId=${encodedId}&sourcePage=SEARCH` },
    { name: "iTaoBuy", url: `https://www.itaobuy.com/product-detail?url=${encodedSourceUrl}` },
    { name: "Didpop", url: `https://www.didpop.com/en/page/buy/?nTag=Home-search&from=search-input&url=${encodedSourceUrl}` },
    { name: "BBDBuy", url: `https://www.bbdbuy.com/goods/WEIDIAN/${encodedId}?from=search` },
    { name: "CnShopper", url: `https://cnshopper.com/product/weidian/${encodedId}` },
    { name: "ESGOBuy", url: `https://www.esgobuy.com/productDetail?url=${encodedSourceUrl}` },
    // 其余平台的链接规则与邀请码（与 Worker 的 affiliateTemplates 保持一致）
    { name: "Litbuy", url: `https://litbuy.com/product/weidian/${encodedId}?inviteCode=XXGYH4Z80` },
    { name: "GTbuy", url: `https://gtbuy.com/product/weidian/${encodedId}?inviteCode=XO78PVRZW` },
    { name: "Hipobuy", url: `https://hipobuy.com/product/weidian/${encodedId}?inviteCode=P6PP29VX7` },
    { name: "Fansbuy", url: `https://fansbuy.com/item-micro-${encodedId}.html?promotionCode=R0dfTU9DRzA2VTk` },
    { name: "LoveGoBuy", url: `https://www.lovegobuy.com/product?shop_type=weidian&id=${encodedId}&invite_code=U577HX` },
    { name: "Hoobuy", url: `https://hoobuy.com/product/2/${encodedId}?inviteCode=K8l2grxX` },
    { name: "UsFans", url: `https://www.usfans.com/product/3/${encodedId}?ref=BCSLQC` },
    { name: "OrientDig", url: `https://orientdig.com/product/?shop_type=weidian&id=${encodedId}&ref=100245718` },
    { name: "Sugargoo", url: `https://www.sugargoo.com/products?productLink=${encodedWeidianUrl}&memberId=3229305473717352480` },
    { name: "BBDBuyEU", url: `https://www.bbdbuyeu.com/goods/WEIDIAN/${encodedId}?inviteCode=j4zwj7` },
    { name: "VigorBuy", url: `https://vigorbuy.com/product/2/${encodedId}?inviteCode=jkNlpqAP` },
    { name: "Fishgoo", url: `https://www.fishgoo.com/#/product?productLink=${encodedWeidianUrl}&memberId=TG2665ux5KieI` },
  ];

  // The supplied UUFans deep link includes a separate QC item id and price that cannot be
  // derived from a Weidian id. Keep the exact user-provided mapping to this item only.
  if (sourceId === "7543342819") {
    sources.push({
      name: "UUFans",
      url: "https://www.uufinds.com/goodItemDetail/qc/1969745225590595586?spuNo=7543342819&channel=weidian&originPrice=27.74&originCurrencyCode=USD",
    });
  }

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
  if (options.withInviteCodes) {
    for (const source of sources) {
      const invite = spreadsheetInviteCodes[normalizePlatformName(source.name)];
      if (invite) source.url = appendInviteCode(source.url, invite);
    }
  }
  return sources.filter((source) => !hiddenPlatformNames.has(normalizePlatformName(source.name)));
}

export function primarySourceFor(product) {
  const sources = platformSourcesFor(product);
  return sources.find((source) => source.primary) || sources[0];
}

// 把用户选择的平台移到首位并设为主平台（不改动传入数组）。
export function prioritizePlatform(sources, name) {
  const key = normalizePlatformName(name);
  if (!key) return sources;
  const index = sources.findIndex((source) => normalizePlatformName(source.name) === key);
  if (index <= 0) return sources;
  const target = { ...sources[index], primary: true };
  const rest = sources.filter((_, position) => position !== index).map((source) => (source.primary ? { ...source, primary: false } : source));
  return [target, ...rest];
}
