import { describe, expect, it } from "vitest";
import { normalizePlatformName, platformIconFor, platformSourcesFor } from "./platformSources.mjs";

const sampleId = "7543342819";
const sourceUrl = `https://shop1784277725.v.weidian.com/item.html?itemID=${sampleId}`;

describe("sampled shopping platform sources", () => {
  it("builds the supplied direct-link rules with the Weidian item ID", () => {
    const sources = platformSourcesFor({ sourceProductId: sampleId });
    const byName = new Map(sources.map((source) => [source.name, source.url]));
    expect(byName.get("Joyagoo")).toBe(`https://joyagoo.com/product?id=${sampleId}&platform=WEIDIAN&productUrl=&productPwd=`);
    expect(byName.get("EastMallBuy")).toContain(`url=${encodeURIComponent(sourceUrl)}`);
    expect(byName.get("EastMallBuy")).toContain("inviter=valeriyachentsov");
    expect(byName.get("Okeyhaul")).toBe(`https://www.okeyhaul.com/mall/detail?sourceUrl=true&spuid=${sampleId}`);
    expect(byName.get("PonyBuy")).toBe(`https://www.ponybuy.com/products/3/${sampleId}`);
    expect(byName.get("HubbuyCN")).toBe(`https://www.hubbuy.com/product/2/${sampleId}`);
    expect(byName.get("CSSBuy")).toBe(`https://www.cssbuy.com/shop/goodsDetail?type=weidian&id=${sampleId}`);
    expect(byName.get("AnovaBuy")).toBe(`https://anovabuy.com/product/${sampleId}?from=search&ecom=3`);
    expect(byName.get("MyCNBox")).toBe(`https://mycnbox.com/goodsDetail?mallType=weidian&itemId=${sampleId}&sourcePage=SEARCH`);
    expect(byName.get("iTaoBuy")).toContain(encodeURIComponent(sourceUrl));
    expect(byName.get("Didpop")).toContain(encodeURIComponent(sourceUrl));
    expect(byName.get("BBDBuy")).toBe(`https://www.bbdbuy.com/goods/WEIDIAN/${sampleId}?from=search`);
    expect(byName.get("CnShopper")).toBe(`https://cnshopper.com/product/weidian/${sampleId}`);
    expect(byName.get("ESGOBuy")).toContain(encodeURIComponent(sourceUrl));
  });

  it("uses the exact user-supplied UUFans URL only for its matching item", () => {
    const matching = platformSourcesFor({ sourceProductId: sampleId });
    const other = platformSourcesFor({ sourceProductId: "1234567890" });
    expect(matching.find((source) => source.name === "UUFans")?.url).toBe("https://www.uufinds.com/goodItemDetail/qc/1969745225590595586?spuNo=7543342819&channel=weidian&originPrice=27.74&originCurrencyCode=USD");
    expect(other.some((source) => source.name === "UUFans")).toBe(false);
  });

  it("reuses existing icons through canonical platform aliases and falls back when no verified logo exists", () => {
    expect(normalizePlatformName("Joyabuy")).toBe("joyagoo");
    expect(normalizePlatformName("Hubbuy")).toBe("hubbuycn");
    expect(platformIconFor("Joyagoo")).toBe("/platform-icons/JoyaGoo.png");
    expect(platformIconFor("HubbuyCN")).toBe("/platform-icons/Hubbuycn.png");
    expect(platformIconFor("AnovaBuy")).toBe("/platform-icons/AnovaBuy.png");
    expect(platformIconFor("Didpop")).toBe("/platform-icons/Didpop.png");
    expect(platformIconFor("ESGOBuy")).toBe("/platform-icons/ESGOBuy.png");
    expect(platformIconFor("Okeyhaul")).toBe("/platform-icons/Okeyhaul.png");
    expect(platformIconFor("MyCNBox")).toBe("/platform-icons/MyCNBox.png");
    expect(platformIconFor("UUFans")).toBe("/platform-icons/UUFans.png");
    expect(platformIconFor("Hagobuy")).toBe("");
  });
});
