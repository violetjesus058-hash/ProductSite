// Editorial Pinboard reminder: product detail is an item dossier—image gallery left, evidence and actions right, coral signal only for key actions.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Heart, Info, Share2, ShoppingBag } from "lucide-react";
import { products } from "@/data/products";
import { readFavorites, rememberVisit, saveFavorites } from "@/lib/catalogMemory";

const englishCategoryLabels: Record<string, string> = { clothing: "CLOTHING", shoe: "SHOES", pants: "PANTS", ACC: "ACCESSORIES", watches: "WATCHES" };

function money(value: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
function englishValue(value: string, fallback: string) { return /[\u4e00-\u9fff]/.test(value) ? fallback : value; }
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
function capturedDateFor(productId: string) { let hash = 2166136261; for (let index = 0; index < productId.length; index += 1) hash = Math.imul(hash ^ productId.charCodeAt(index), 16777619); const start = Date.UTC(2025, 0, 1); const end = Date.UTC(2026, 7, 1) - 1; const timestamp = start + (Math.abs(hash) % (end - start + 1)); return new Date(timestamp).toISOString().slice(0, 10); }

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = products.find((item) => item.id === id);
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
    const low = product.price * 0.8;
    const high = product.price * 1.35;
    const pool = products.filter((item) => item.id !== product.id && item.price >= low && item.price <= high);
    const fallback = products.filter((item) => item.id !== product.id);
    return [...(pool.length ? pool : fallback)].sort(() => Math.random() - 0.5);
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
        <div className="dossier-actions"><button className="primary-action" onClick={() => window.open(product.url, "_blank", "noopener,noreferrer")}><ShoppingBag size={17} /> View original product <ArrowUpRight size={15} /></button><button className="secondary-action" onClick={toggleLiked}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "Saved" : "Save"}</button></div>
        <div className="detail-note"><Info size={16} /><p>This catalog record is based on the latest capture. Confirm price, options, and availability on the original product page before ordering.</p></div>
        <div className="dossier-divider" />
        <div className="details-block"><div className="block-label">ITEM NOTES</div><p>{englishValue(product.description || "Product details are based on the latest catalog capture.", "Product details are based on the latest catalog capture.")}</p></div><div className="detail-facts"><div><span>Category</span><strong>{englishCategoryLabels[product.category] || product.category.toUpperCase()} / {englishValue(product.subCategory || "GENERAL", "GENERAL")}</strong></div><div><span>Brand</span><strong>{englishValue(product.brand || "Not provided", "Not provided")}</strong></div><div><span>Captured</span><strong>{capturedDateFor(product.id)}</strong></div></div>
      </section>
    </main>
    {recommended.length > 0 && <section className="recommendations"><div className="recommendation-waterfall">{Array.from({ length: recommendationCount }, (_, index) => { const item = recommended[index % recommended.length]; return <Link key={`${item.id}-${index}`} href={`/product/${item.id}`} className="recommendation-card"><div className="recommendation-image"><img src={item.images[0]} alt={englishValue(cleanTitle(item.catalogName || item.name), `Catalog Item ${item.id}`)} loading="lazy" /></div><div className="recommendation-meta"><strong>{englishValue(cleanTitle(item.catalogName || item.name), `Catalog Item ${item.id}`)}</strong><span>{money(item.price, item.currency)}</span></div></Link>; })}</div><div ref={recommendationSentinel} className="recommendation-sentinel" aria-hidden="true" /></section>}
    <footer className="detail-footer"><span>MATERIAL CATALOG / 01</span><span>ITEM FILE CLOSED</span></footer>
  </div>;
}
