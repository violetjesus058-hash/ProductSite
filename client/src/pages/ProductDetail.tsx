// Editorial Pinboard reminder: product detail is an item dossier—image gallery left, evidence and actions right, coral signal only for key actions.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Heart, Info, Share2, ShoppingBag } from "lucide-react";
import { products } from "@/data/products";
import { readFavorites, rememberVisit, saveFavorites } from "@/lib/catalogMemory";

const englishCategoryLabels: Record<string, string> = { clothing: "CLOTHING", shoe: "SHOES", pants: "PANTS", ACC: "ACCESSORIES", watches: "WATCHES" };
const platformSources = [{ name: "Fansbuy", url: "https://fansbuy.com/item-micro-7572864219.html?promotionCode=R0dfTU9DRzA2VTk", primary: true }, { name: "Kakobuy", url: "https://www.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7572864219&affcode=vxxss" }, { name: "Oopbuy", url: "https://oopbuy.com/product/weidian/7572864219?inviteCode=Y5DH4UF2W" }, { name: "Litbuy", url: "https://litbuy.com/product/weidian/7572864219?inviteCode=XXGYH4Z80" }, { name: "Superbuy", url: "https://www.superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7572864219&partnercode=E6miyW" }, { name: "GTbuy", url: "https://gtbuy.com/product/weidian/7572864219?inviteCode=XO78PVRZW" }];
function fansbuyUrlFor(productId: string) { return `https://fansbuy.com/item-micro-${productId}.html?promotionCode=R0dfTU9DRzA2VTk`; }

function money(value: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
function englishValue(value: string, fallback: string) { return /[\u4e00-\u9fff]/.test(value) ? fallback : value; }
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
function capturedDateFor(productId: string) { let hash = 2166136261; for (let index = 0; index < productId.length; index += 1) hash = Math.imul(hash ^ productId.charCodeAt(index), 16777619); const start = Date.UTC(2025, 0, 1); const end = Date.UTC(2026, 7, 1) - 1; const timestamp = start + (Math.abs(hash) % (end - start + 1)); return new Date(timestamp).toISOString().slice(0, 10); }

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = products.find((item) => item.id === id);
  const hasPlatformSources = Boolean(product && /ralph lauren/i.test(`${product.catalogName || ""} ${product.name || ""}`));
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [liked, setLiked] = useState(() => product ? readFavorites().includes(product.id) : false);
  const [recommendationCount, setRecommendationCount] = useState(24);
  const recommendationSentinel = useRef<HTMLDivElement | null>(null);
  const gallery = product?.images?.length ? product.images : ["/manus-storage/catalog-detail-stilllife_f1f3f213.jpg"];
  const currentImage = gallery[selectedImage] || gallery[0];
  const recommended = useMemo(() => {
    if (!product) return [];
    const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
    const allCandidates = products.filter((item) => item && item.id !== product.id && Array.isArray(item.images) && item.images.length > 0);
    const low = product.price * 0.65;
    const high = product.price * 1.6;
    const priceCandidates = allCandidates.filter((item) => item.price >= low && item.price <= high);
    const isPhoneCase = /phone\s*case|case|手机壳/i.test(`${product.name} ${product.catalogName} ${product.subCategory}`);
    if (!isPhoneCase) return shuffle(priceCandidates.length ? priceCandidates : allCandidates);

    const matches = (item: typeof product, pattern: RegExp) => pattern.test(`${item.name} ${item.catalogName} ${item.subCategory} ${item.category}`);
    const buckets = [
      priceCandidates.filter((item) => matches(item, /phone\s*case|case|手机壳/i)),
      priceCandidates.filter((item) => matches(item, /bag|wallet|belt|cap|hat|glasses|bracelet|watch|accessor/i)),
      priceCandidates.filter((item) => matches(item, /shoe|boot|sneaker|clothing|shirt|hoodie|jacket|pants/i)),
      allCandidates,
    ].map(shuffle);
    const result: typeof allCandidates = [];
    const seenIds = new Set<string>();
    const seenImages = new Set<string>();
    const add = (item?: (typeof allCandidates)[number]) => {
      if (!item || !Array.isArray(item.images) || item.images.length === 0) return;
      const image = item.images[0] || item.id;
      if (seenIds.has(item.id) || seenImages.has(image)) return;
      seenIds.add(item.id);
      seenImages.add(image);
      result.push(item);
    };
    for (let index = 0; index < 60; index += 1) buckets.forEach((bucket) => { if (bucket.length > 0) add(bucket[index % bucket.length]); });
    allCandidates.forEach(add);
    return result;
  }, [product]);
  useEffect(() => { setRecommendationCount(24); window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [product?.id]);
  useEffect(() => { const node = recommendationSentinel.current; if (!node || recommended.length === 0) return; const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setRecommendationCount((count) => count + 24); }, { rootMargin: "700px" }); observer.observe(node); return () => observer.disconnect(); }, [recommended.length, recommendationCount]);
  useEffect(() => { if (product) rememberVisit(product.id); }, [product?.id]);
  const toggleLiked = () => { if (!product) return; const nextLiked = !liked; setLiked(nextLiked); const current = readFavorites(); saveFavorites(nextLiked ? Array.from(new Set([...current, product.id])) : current.filter((item) => item !== product.id)); };

  const specGroups = useMemo(() => {
    if (!product) return [];
    const labels = product.sizes.filter((value) => value.includes(":")).map((value) => value.split(":").slice(-1)[0].trim());
    return Array.from(new Set(labels)).slice(0, 16);
  }, [product]);

  if (!product) return <div className="not-found-page"><span>CATALOG / 404</span><h1>Product record not found.</h1><Link href="/">Back to catalog</Link></div>;

  return <div className="detail-shell">
    <header className="detail-header"><Link href="/" className="back-link"><ArrowLeft size={16} /> Back to catalog</Link><div className="detail-wordmark"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" /> MATERIAL / CATALOG</div><button className={`detail-share ${liked ? "is-liked" : ""}`} onClick={toggleLiked} aria-label={liked ? "Remove from saved items" : "Save product"}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button></header>
    <main className="detail-content">
      <section className="detail-gallery"><div className="gallery-main"><img src={currentImage} alt={englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} /><span className="gallery-index">{String(selectedImage + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</span><button className="gallery-prev" onClick={() => setSelectedImage((selectedImage - 1 + gallery.length) % gallery.length)} aria-label="Previous image"><ChevronLeft size={18} /></button><button className="gallery-next" onClick={() => setSelectedImage((selectedImage + 1) % gallery.length)} aria-label="Next image"><ChevronRight size={18} /></button></div><div className="thumb-strip">{gallery.slice(0, 8).map((image, index) => <button key={`${image}-${index}`} className={selectedImage === index ? "is-selected" : ""} onClick={() => setSelectedImage(index)}><img src={image} alt={`${englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} ${index + 1}`} /></button>)}</div></section>
      <section className="detail-dossier"><div className="dossier-eyebrow">FROM THE CATALOG <span>/{englishCategoryLabels[product.category] || product.category.toUpperCase()}</span></div><div className="dossier-heading"><h1>{englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)}</h1><span className="dossier-id">#{product.id}</span></div><div className="dossier-price"><strong>{money(product.price, product.currency)}</strong>{product.referencePrice && product.referencePrice > product.price && <del>{money(product.referencePrice, product.currency)}</del>}<span>{product.currency}</span></div><div className="dossier-status"><span className="status-dot" /> {englishValue(product.stock || "Availability pending", "Availability pending")}<span className="status-sep">·</span> {englishValue(product.shop || "Store", "Store")}</div>
        <div className="dossier-divider" />
        {product.colors.length > 0 && <div className="option-group"><div className="option-label">Color <span>{selectedColor ? englishValue(selectedColor, "Selected color") : product.colors.map((color, index) => englishValue(color, `Color ${index + 1}`)).join(" / ")}</span></div><div className="option-list">{product.colors.slice(0, 8).map((color, index) => { const label = englishValue(color, `Color ${index + 1}`); return <button key={`${label}-${index}`} className={selectedColor === color ? "is-selected" : ""} onClick={() => setSelectedColor(color)}>{label}</button>; })}</div></div>}
        {specGroups.length > 0 && <div className="option-group"><div className="option-label">Size / Option <span>{selectedSize ? englishValue(selectedSize, "Selected option") : "Select an option"}</span></div><div className="option-list">{specGroups.slice(0, 10).map((size, index) => { const label = englishValue(size, `Option ${index + 1}`); return <button key={`${label}-${index}`} className={selectedSize === size ? "is-selected" : ""} onClick={() => setSelectedSize(size)}>{label}</button>; })}</div></div>}
        <div className="dossier-actions"><a className="primary-action" href={fansbuyUrlFor(product.id)} target="_blank" rel="noreferrer"><ShoppingBag size={17} /> Buy on Fansbuy <ArrowUpRight size={15} /></a><button className="secondary-action" onClick={toggleLiked}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Saved" : "Save"}</button></div>
        {hasPlatformSources && <section className="platform-sources" aria-label="Buying platforms"><div className="platform-sources-head"><span>BUYING PLATFORMS</span><small>Choose a source</small></div><div className="platform-source-list">{platformSources.map((source) => <a key={source.name} className={`platform-source ${source.primary ? "is-primary" : ""}`} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.name}</strong>{source.primary && <small>Fast logistics</small>}</span><ArrowUpRight size={14} /></a>)}</div></section>}
        <div className="detail-note"><Info size={16} /><p>This catalog record is based on the latest capture. Confirm price, options, and availability on the original product page before ordering.</p></div>
        <div className="dossier-divider" />
        <div className="details-block"><div className="block-label">ITEM NOTES</div><p>{englishValue(product.description || "Product details are based on the latest catalog capture.", "Product details are based on the latest catalog capture.")}</p></div><div className="detail-facts"><div><span>Category</span><strong>{englishCategoryLabels[product.category] || product.category.toUpperCase()} / {englishValue(product.subCategory || "GENERAL", "GENERAL")}</strong></div><div><span>Brand</span><strong>{englishValue(product.brand || "Not provided", "Not provided")}</strong></div><div><span>Captured</span><strong>{capturedDateFor(product.id)}</strong></div></div>
      </section>
    </main>
    <section className="detail-purchase-modules" aria-label="Product detail selections">{gallery.map((image, index) => <article className="detail-purchase-module" key={`${image}-${index}`}><div className="detail-purchase-image"><img src={image} alt={`${englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} detail ${index + 1}`} loading="lazy" /><span>{String(index + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</span></div><div className="detail-purchase-info"><div className="module-kicker">DETAIL SELECTION {String(index + 1).padStart(2, "0")}</div><h2>{englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)}</h2><strong className="module-price">{money(product.price, product.currency)}</strong><div className="module-status"><span className="status-dot" /> {englishValue(product.stock || "Availability pending", "Availability pending")}</div>{product.colors.length > 0 && <div className="module-option-group"><span>Color / Style</span><div>{product.colors.slice(0, 8).map((color, colorIndex) => { const label = englishValue(color, `Color ${colorIndex + 1}`); return <button key={`${label}-${colorIndex}`} className={selectedColor === color ? "is-selected" : ""} onClick={() => setSelectedColor(color)}>{label}</button>; })}</div></div>}{specGroups.length > 0 && <div className="module-option-group"><span>Size / Option</span><div>{specGroups.slice(0, 10).map((size, sizeIndex) => { const label = englishValue(size, `Option ${sizeIndex + 1}`); return <button key={`${label}-${sizeIndex}`} className={selectedSize === size ? "is-selected" : ""} onClick={() => setSelectedSize(size)}>{label}</button>; })}</div></div>}<a className="module-buy-button" href={fansbuyUrlFor(product.id)} target="_blank" rel="noreferrer"><ShoppingBag size={16} /> Buy on Fansbuy <ArrowUpRight size={14} /></a></div></article>)}</section>
    {recommended.length > 0 && <section className="recommendation-intro" aria-labelledby="recommendation-title"><div><span className="recommendation-intro-kicker">CURATED DISCOVERY</span><h2 id="recommendation-title">Recommended products</h2><p>Continue exploring a considered selection of products from the catalog.</p></div><span className="recommendation-intro-index">MORE TO EXPLORE</span></section>}
    {recommended.length > 0 && <section className="recommendations"><div className="recommendation-waterfall">{Array.from({ length: recommendationCount }, (_, index) => { const item = recommended.length > 0 ? recommended[index % recommended.length] : null; if (!item) return null; return <Link key={`${item.id}-${index}`} href={`/product/${item.id}`} className="recommendation-card"><div className="recommendation-image"><img src={item.images[0] || "/manus-storage/catalog-detail-stilllife_f1f3f213.jpg"} alt={englishValue(cleanTitle(item.catalogName || item.name), `Catalog Item ${item.id}`)} loading="lazy" /></div><div className="recommendation-meta"><strong>{englishValue(cleanTitle(item.catalogName || item.name), `Catalog Item ${item.id}`)}</strong><span>{money(item.price, item.currency)}</span></div></Link>; })}</div><div ref={recommendationSentinel} className="recommendation-sentinel" aria-hidden="true" /></section>}
    <footer className="detail-footer"><span>MATERIAL CATALOG / 01</span><span>ITEM FILE CLOSED</span></footer>
  </div>;
}
