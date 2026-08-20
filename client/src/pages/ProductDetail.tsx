// Editorial Pinboard reminder: product detail is an item dossier—image gallery left, evidence and actions right, coral signal only for key actions.
// Editorial Pinboard detail page: Kakobuy is the primary commerce source for migrated catalog records; preserve the tactile paper, asymmetric dossier layout, and restrained coral actions.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Heart, Info, Share2, ShoppingBag } from "lucide-react";
import { products } from "@/data/products";
import { readFavorites, rememberVisit, saveFavorites } from "@/lib/catalogMemory";
import SafeProductImage from "@/components/SafeProductImage";

const englishCategoryLabels: Record<string, string> = { clothing: "CLOTHING", shoe: "SHOES", pants: "PANTS", bags: "BAGS", fragrance: "FRAGRANCE", ACC: "ACCESSORIES", watches: "WATCHES" };
type PlatformSource = { name: string; url: string; primary?: boolean };
function platformSourcesFor(product: (typeof products)[number]): PlatformSource[] {
  const sourceId = product.sourceProductId || product.id;
  const isKakobuy = /kakobuy\.com/i.test(product.url || "");
  const encodedWeidianUrl = encodeURIComponent(`https://weidian.com/item.html?itemID=${sourceId}`);
  const kakobuyUrl = isKakobuy ? product.url : `https://www.kakobuy.com/item/details?url=${encodedWeidianUrl}&affcode=vxxss`;
  const sources: PlatformSource[] = [
    { name: "Kakobuy", url: kakobuyUrl, primary: isKakobuy },
    { name: "Superbuy", url: `https://www.superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&url=${encodedWeidianUrl}&partnercode=E6miyW` },
  ];
  for (const [name, url] of Object.entries(product.platformLinks || {})) {
    if (url && !sources.some((source) => source.name === name)) sources.push({ name, url });
  }
  if (!isKakobuy && product.url && !sources.some((source) => source.name === "Fansbuy")) sources.unshift({ name: "Fansbuy", url: product.url, primary: true });
  return sources;
}
function primarySourceFor(product: (typeof products)[number]) { return platformSourcesFor(product).find((source) => source.primary) || platformSourcesFor(product)[0]; }

function money(value: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
function englishValue(value: string, fallback: string) { return /[\u4e00-\u9fff]/.test(value) ? fallback : value; }
function isApparelProduct(product: (typeof products)[number]) { return product.category === "clothing" || product.category === "pants"; }
function optionHeadingFor(product: (typeof products)[number]) { return isApparelProduct(product) ? "Size" : "Size / Option"; }
function formatOptionLabel(value: string, heading: string, index: number) {
  const cleaned = value.split(/[;:|]/).slice(-1)[0].trim();
  if (heading === "Size") {
    if (/均码|one\s*size/i.test(cleaned)) return "One size";
    const numeric = cleaned.match(/^(?:size\s*)?(\d+(?:\.\d+)?)\s*(?:码|cm)?$/i);
    if (numeric) return `Size ${numeric[1]}`;
    if (/^(xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(cleaned)) return cleaned.toUpperCase();
    return englishValue(cleaned, `Size ${index + 1}`);
  }
  return englishValue(cleaned, `Option ${index + 1}`);
}
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
function capturedDateFor(productId: string) { let hash = 2166136261; for (let index = 0; index < productId.length; index += 1) hash = Math.imul(hash ^ productId.charCodeAt(index), 16777619); const start = Date.UTC(2025, 0, 1); const end = Date.UTC(2026, 7, 1) - 1; const timestamp = start + (Math.abs(hash) % (end - start + 1)); return new Date(timestamp).toISOString().slice(0, 10); }
function setMeta(attribute: "name" | "property", key: string, content: string) { let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`); if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.appendChild(node); } node.content = content; }
function setCanonical(url: string) { let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!node) { node = document.createElement("link"); node.rel = "canonical"; document.head.appendChild(node); } node.href = url; }
function ZoomableDetailImage({ image, alt, label }: { image: string; alt: string; label: string }) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)) });
  };
  return <div className="detail-purchase-image" onMouseMove={handleMove} onMouseEnter={handleMove} onMouseLeave={() => setPosition({ x: 50, y: 50 })}>
    <SafeProductImage sources={[image]} alt={alt} loading="lazy" />
    <div className="detail-image-zoom" aria-hidden="true" style={{ backgroundImage: `url(${image})`, backgroundPosition: `${position.x}% ${position.y}%` }} />
    <span className="detail-image-index">{label}</span>
  </div>;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = products.find((item) => item.id === id);
  const platformSources = product ? platformSourcesFor(product) : [];
  const hasPlatformSources = platformSources.length > 1;
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [liked, setLiked] = useState(() => product ? readFavorites().includes(product.id) : false);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [recommendationCount, setRecommendationCount] = useState(24);
  const recommendationSentinel = useRef<HTMLDivElement | null>(null);
  const gallery = product?.images?.length ? product.images : ["/catalog-detail-stilllife.webp"];
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
  useEffect(() => {
    if (!product) return;
    const title = englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`);
    const category = englishCategoryLabels[product.category] || product.category.toUpperCase();
    const description = `${title} — a ${category.toLowerCase()} catalog record on Material Catalog. Review options, price, and availability before ordering.`;
    const canonicalUrl = `${window.location.origin}/product/${product.id}`;
    const imageUrl = new URL(product.images?.[0] || "/og-cover.svg", window.location.origin).href;
    document.documentElement.lang = "en";
    document.title = `${title} — Material Catalog`;
    setCanonical(canonicalUrl);
    setMeta("name", "description", description);
    setMeta("property", "og:locale", "en_US");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "Material Catalog");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:alt", `${title} product image`);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
    setMeta("name", "twitter:image:alt", `${title} product image`);
    setMeta("property", "product:price:amount", product.price.toFixed(2));
    setMeta("property", "product:price:currency", product.currency);
    if (product.collectedAt) setMeta("property", "article:modified_time", product.collectedAt);
  }, [product]);
  const toggleLiked = () => { if (!product) return; const nextLiked = !liked; setLiked(nextLiked); const current = readFavorites(); saveFavorites(nextLiked ? Array.from(new Set([...current, product.id])) : current.filter((item) => item !== product.id)); };
  const shareUrl = typeof window !== "undefined" ? window.location.href : `/product/${product?.id || ""}`;
  const shareTitle = product ? englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`) : "Material Catalog product";
  const shareText = `Take a look at ${shareTitle} on Material Catalog.`;
  const shareLinks = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { name: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
  ];
  const copyProductLink = async () => { try { await navigator.clipboard.writeText(shareUrl); setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 1800); } catch { window.prompt("Copy product link", shareUrl); } };

  const specGroups = useMemo(() => {
    if (!product) return [];
    const labels = product.sizes.map((value) => value.split(/[;:|]/).slice(-1)[0].trim()).filter(Boolean);
    return Array.from(new Set(labels)).slice(0, 16);
  }, [product]);

  if (!product) return <div className="not-found-page"><span>CATALOG / 404</span><h1>Product record not found.</h1><Link href="/">Back to catalog</Link></div>;

  return <div className="detail-shell">
    <header className="detail-header"><Link href="/" className="back-link"><ArrowLeft size={16} /> Back to catalog</Link><div className="detail-wordmark"><img src="/catalog-mark.webp" alt="" /> MATERIAL / CATALOG</div><div className="detail-header-actions"><div className="share-control"><button className="detail-share-button" onClick={() => setShareOpen((open) => !open)} aria-expanded={shareOpen} aria-haspopup="menu"><Share2 size={17} /> <span>Share</span></button>{shareOpen && <div className="share-menu" role="menu"><div className="share-menu-title">SHARE THIS PRODUCT</div><button className="share-copy" onClick={copyProductLink}><span>{linkCopied ? "Link copied" : "Copy product link"}</span><Share2 size={14} /></button>{shareLinks.map((item) => <a key={item.name} href={item.href} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setShareOpen(false)}>{item.name}<ArrowUpRight size={13} /></a>)}{typeof navigator !== "undefined" && "share" in navigator && <button className="share-native" onClick={() => { navigator.share?.({ title: shareTitle, text: shareText, url: shareUrl }); setShareOpen(false); }}>More sharing options<ArrowUpRight size={13} /></button>}</div>}</div><button className={`detail-share ${liked ? "is-liked" : ""}`} onClick={toggleLiked} aria-label={liked ? "Remove from saved items" : "Save product"}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button></div></header>
    <main className="detail-content">
      <section className="detail-gallery"><div className="gallery-main"><SafeProductImage sources={gallery} alt={englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} loading="eager" /><span className="gallery-index">{String(selectedImage + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</span><button className="gallery-prev" onClick={() => setSelectedImage((selectedImage - 1 + gallery.length) % gallery.length)} aria-label="Previous image"><ChevronLeft size={18} /></button><button className="gallery-next" onClick={() => setSelectedImage((selectedImage + 1) % gallery.length)} aria-label="Next image"><ChevronRight size={18} /></button></div><div className="thumb-strip">{gallery.slice(0, 8).map((image, index) => <button key={`${image}-${index}`} className={selectedImage === index ? "is-selected" : ""} onClick={() => setSelectedImage(index)}><SafeProductImage sources={gallery.slice(index)} alt={`${englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} ${index + 1}`} /></button>)}</div></section>
      <section className="detail-dossier"><div className="dossier-eyebrow">FROM THE CATALOG <span>/{englishCategoryLabels[product.category] || product.category.toUpperCase()}</span></div><div className="dossier-heading"><h1>{englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)}</h1><span className="dossier-id">#{product.id}</span></div><div className="dossier-price"><strong>{money(product.price, product.currency)}</strong>{product.referencePrice && product.referencePrice > product.price && <del>{money(product.referencePrice, product.currency)}</del>}<span>{product.currency}</span></div><div className="dossier-status"><span className="status-dot" /> {englishValue(product.stock || "Availability pending", "Availability pending")}<span className="status-sep">·</span> {englishValue(product.shop || "Store", "Store")}</div>
        <div className="dossier-divider" />
        {product.colors.length > 0 && <div className="option-group"><div className="option-label">Color <span>{selectedColor ? englishValue(selectedColor, "Selected color") : product.colors.map((color, index) => englishValue(color, `Color ${index + 1}`)).join(" / ")}</span></div><div className="option-list">{product.colors.slice(0, 8).map((color, index) => { const label = englishValue(color, `Color ${index + 1}`); return <button key={`${label}-${index}`} className={selectedColor === color ? "is-selected" : ""} onClick={() => setSelectedColor(color)}>{label}</button>; })}</div></div>}
        {specGroups.length > 0 && <div className="option-group"><div className="option-label">{optionHeadingFor(product)} <span>{selectedSize ? formatOptionLabel(selectedSize, optionHeadingFor(product), 0) : `Select ${optionHeadingFor(product).toLowerCase()}`}</span></div><div className="option-list">{specGroups.slice(0, 10).map((size, index) => { const label = formatOptionLabel(size, optionHeadingFor(product), index); return <button key={`${label}-${index}`} className={selectedSize === size ? "is-selected" : ""} onClick={() => setSelectedSize(size)}>{label}</button>; })}</div></div>}
        <div className="dossier-actions"><a className="primary-action" href={primarySourceFor(product).url} target="_blank" rel="noreferrer"><ShoppingBag size={17} /> Buy on {primarySourceFor(product).name} <ArrowUpRight size={15} /></a><button className="secondary-action" onClick={toggleLiked}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Saved" : "Save"}</button></div>
        {hasPlatformSources && <section className="platform-sources" aria-label="Buying platforms"><div className="platform-sources-head"><span>BUYING PLATFORMS</span><small>Choose a source</small></div><div className="platform-source-list">{platformSources.map((source) => <a key={source.name} className={`platform-source ${source.primary ? "is-primary" : ""}`} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.name}</strong>{source.primary && <small>Fast logistics</small>}</span><ArrowUpRight size={14} /></a>)}</div></section>}
        <div className="detail-note"><Info size={16} /><p>This catalog record is based on the latest capture. Confirm price, options, and availability on the original product page before ordering.</p></div>
        <div className="dossier-divider" />
        <div className="details-block"><div className="block-label">ITEM NOTES</div><p>{englishValue(product.description || "Product details are based on the latest catalog capture.", "Product details are based on the latest catalog capture.")}</p></div><div className="detail-facts"><div><span>Category</span><strong>{englishCategoryLabels[product.category] || product.category.toUpperCase()} / {englishValue(product.subCategory || "GENERAL", "GENERAL")}</strong></div><div><span>Brand</span><strong>{englishValue(product.brand || "Not provided", "Not provided")}</strong></div><div><span>Captured</span><strong>{capturedDateFor(product.id)}</strong></div></div>
      </section>
    </main>
    <section className="detail-purchase-modules" aria-label="Product detail selections">{gallery.map((image, index) => <article className="detail-purchase-module" key={`${image}-${index}`}><ZoomableDetailImage image={image} alt={`${englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} detail ${index + 1}`} label={`${String(index + 1).padStart(2, "0")} / ${String(gallery.length).padStart(2, "0")}`} /><div className="detail-purchase-info"><div className="module-kicker">DETAIL SELECTION {String(index + 1).padStart(2, "0")}</div><h2>{englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)}</h2><strong className="module-price">{money(product.price, product.currency)}</strong><div className="module-status"><span className="status-dot" /> {englishValue(product.stock || "Availability pending", "Availability pending")}</div>{product.colors.length > 0 && <div className="module-option-group"><span>Color / Style</span><div>{product.colors.slice(0, 8).map((color, colorIndex) => { const label = englishValue(color, `Color ${colorIndex + 1}`); return <button key={`${label}-${colorIndex}`} className={selectedColor === color ? "is-selected" : ""} onClick={() => setSelectedColor(color)}>{label}</button>; })}</div></div>}{specGroups.length > 0 && <div className="module-option-group"><span>{optionHeadingFor(product)}</span><div>{specGroups.slice(0, 10).map((size, sizeIndex) => { const label = formatOptionLabel(size, optionHeadingFor(product), sizeIndex); return <button key={`${label}-${sizeIndex}`} className={selectedSize === size ? "is-selected" : ""} onClick={() => setSelectedSize(size)}>{label}</button>; })}</div></div>}<a className="module-buy-button" href={primarySourceFor(product).url} target="_blank" rel="noreferrer"><ShoppingBag size={16} /> Buy on {primarySourceFor(product).name} <ArrowUpRight size={14} /></a>{hasPlatformSources && <div className="module-platform-list" aria-label="Other buying platforms">{platformSources.filter((source) => !source.primary).map((source) => <a key={source.name} className="module-platform-link" href={source.url} target="_blank" rel="noreferrer"><span>{source.name}</span><ArrowUpRight size={12} /></a>)}</div>}</div></article>)}</section>
    {recommended.length > 0 && <section className="recommendation-intro" aria-labelledby="recommendation-title"><div className="recommendation-intro-copy"><span className="recommendation-intro-kicker">CURATED DISCOVERY <i>/ 02</i></span><h2 id="recommendation-title">A considered edit<br className="recommendation-title-break" /> from the catalog.</h2><p>Continue exploring adjacent pieces selected for their category, format, and price.</p></div><div className="recommendation-intro-aside"><span className="recommendation-intro-index">EDITORIAL SELECTION</span><span className="recommendation-intro-rule" /><span className="recommendation-intro-count">24+ pieces to explore</span></div></section>}
    {recommended.length > 0 && <section className="recommendations"><div className="recommendation-waterfall">{Array.from({ length: recommendationCount }, (_, index) => { const item = recommended.length > 0 ? recommended[index % recommended.length] : null; if (!item) return null; const title = englishValue(cleanTitle(item.catalogName || item.name), `Catalog Item ${item.id}`); const note = item.subCategory ? `Observed format: ${englishValue(item.subCategory, "catalog format")}. Review the product page for the listed options.` : "Catalog observation: review the product page for the listed options and details."; return <Fragment key={`${item.id}-${index}`}><Link href={`/product/${item.id}`} className="recommendation-card"><div className="recommendation-image"><SafeProductImage sources={item.images} alt={title} loading="lazy" /></div><div className="recommendation-meta"><strong>{title}</strong><span>{money(item.price, item.currency)}</span></div></Link>{(index + 1) % 16 === 0 && <Link href={`/product/${item.id}`} className="editorial-note-card recommendation-note-card"><div className="editorial-note-mark">FIELD NOTE</div><div className="editorial-note-title">{title}</div><p>{note}</p><span>Open product <ArrowUpRight size={13} /></span></Link>}</Fragment>; })}</div><div ref={recommendationSentinel} className="recommendation-sentinel" aria-hidden="true" /></section>}
    <footer className="detail-footer"><span>MATERIAL CATALOG / 01</span><span>ITEM FILE CLOSED</span></footer>
  </div>;
}
