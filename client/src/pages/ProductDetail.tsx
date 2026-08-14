// Editorial Pinboard reminder: product detail is an item dossier—image gallery left, evidence and actions right, coral signal only for key actions.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Heart, Info, Share2, ShoppingBag } from "lucide-react";
import { products, categoryLabels } from "@/data/products";

function money(value: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = products.find((item) => item.id === id);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [liked, setLiked] = useState(false);
  const [recIndex, setRecIndex] = useState(0);
  const gallery = product?.images?.length ? product.images : ["/manus-storage/catalog-detail-stilllife_f1f3f213.jpg"];
  const currentImage = gallery[selectedImage] || gallery[0];
  const recommended = useMemo(() => {
    if (!product) return [];
    const low = product.price * 0.8;
    const high = product.price * 1.35;
    const pool = products.filter((item) => item.id !== product.id && item.price >= low && item.price <= high).sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price));
    const fallback = products.filter((item) => item.id !== product.id).sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price));
    return [...(pool.length ? pool : fallback)].sort(() => Math.random() - 0.5);
  }, [product]);
  const activeRecommendation = recommended[recIndex];
  const recommendationSpecs = activeRecommendation?.sizes.filter((value) => value.includes(":")).map((value) => value.split(":").slice(-1)[0].trim()).filter(Boolean).slice(0, 8) || [];
  useEffect(() => setRecIndex(0), [product?.id]);

  const specGroups = useMemo(() => {
    if (!product) return [];
    const labels = product.sizes.filter((value) => value.includes(":")).map((value) => value.split(":").slice(-1)[0].trim());
    return Array.from(new Set(labels)).slice(0, 16);
  }, [product]);

  if (!product) return <div className="not-found-page"><span>CATALOG / 404</span><h1>商品档案不存在。</h1><Link href="/">返回商品目录</Link></div>;

  return <div className="detail-shell">
    <header className="detail-header"><Link href="/" className="back-link"><ArrowLeft size={16} /> 返回目录</Link><div className="detail-wordmark"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" /> MATERIAL / CATALOG</div><button className={`detail-share ${liked ? "is-liked" : ""}`} onClick={() => setLiked(!liked)} aria-label="收藏商品"><Heart size={18} fill={liked ? "currentColor" : "none"} /></button></header>
    <main className="detail-content">
      <section className="detail-gallery"><div className="gallery-main"><img src={currentImage} alt={cleanTitle(product.catalogName || product.name)} /><span className="gallery-index">{String(selectedImage + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</span><button className="gallery-prev" onClick={() => setSelectedImage((selectedImage - 1 + gallery.length) % gallery.length)} aria-label="上一张"><ChevronLeft size={18} /></button><button className="gallery-next" onClick={() => setSelectedImage((selectedImage + 1) % gallery.length)} aria-label="下一张"><ChevronRight size={18} /></button></div><div className="thumb-strip">{gallery.slice(0, 8).map((image, index) => <button key={`${image}-${index}`} className={selectedImage === index ? "is-selected" : ""} onClick={() => setSelectedImage(index)}><img src={image} alt={`${product.catalogName || product.name} ${index + 1}`} /></button>)}</div></section>
      <section className="detail-dossier"><div className="dossier-eyebrow">FROM THE CATALOG <span>/{categoryLabels[product.category] || product.category}</span></div><div className="dossier-heading"><h1>{cleanTitle(product.catalogName || product.name)}</h1><span className="dossier-id">#{product.id}</span></div><div className="dossier-price"><strong>{money(product.price, product.currency)}</strong>{product.referencePrice && product.referencePrice > product.price && <del>{money(product.referencePrice, product.currency)}</del>}<span>{product.currency}</span></div><div className="dossier-status"><span className="status-dot" /> {product.stock || "状态待确认"}<span className="status-sep">·</span> {product.shop || "供应店铺"}</div>
        <div className="dossier-divider" />
        {product.colors.length > 0 && <div className="option-group"><div className="option-label">颜色 <span>{selectedColor || product.colors.join(" / ")}</span></div><div className="option-list">{product.colors.slice(0, 8).map((color, index) => <button key={`${color}-${index}`} className={selectedColor === color ? "is-selected" : ""} onClick={() => setSelectedColor(color)}>{color}</button>)}</div></div>}
        {specGroups.length > 0 && <div className="option-group"><div className="option-label">规格 <span>{selectedSize || "请选择"}</span></div><div className="option-list">{specGroups.slice(0, 10).map((size, index) => <button key={`${size}-${index}`} className={selectedSize === size ? "is-selected" : ""} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></div>}
        <div className="dossier-actions"><button className="primary-action" onClick={() => window.open(product.url, "_blank", "noopener,noreferrer")}><ShoppingBag size={17} /> 查看原始商品链接 <ArrowUpRight size={15} /></button><button className="secondary-action" onClick={() => setLiked(!liked)}><Heart size={16} fill={liked ? "currentColor" : "none"} /> {liked ? "已收藏" : "收藏"}</button></div>
        <div className="detail-note"><Info size={16} /><p>这是目录中的商品档案页。价格、规格和库存状态来自最近一次采集，正式下单前请以原始商品页面为准。</p></div>
        <div className="dossier-divider" />
        <div className="details-block"><div className="block-label">ITEM NOTES</div><p>{product.description || "该商品暂无文字描述，图片与规格信息以页面采集结果为准。"}</p></div><div className="detail-facts"><div><span>分类</span><strong>{categoryLabels[product.category] || product.category} / {product.subCategory}</strong></div><div><span>品牌</span><strong>{product.brand || "未提供"}</strong></div><div><span>采集时间</span><strong>{product.collectedAt ? product.collectedAt.slice(0, 10) : "—"}</strong></div></div>
      </section>
    </main>
    {recommended.length > 0 && <section className="recommendations"><div className="recommendation-only-controls"><button onClick={() => setRecIndex((index) => (index - 1 + recommended.length) % recommended.length)} aria-label="上一个推荐商品">←</button><button onClick={() => setRecIndex((index) => (index + 1) % recommended.length)} aria-label="下一个推荐商品">→</button></div><div className="recommendation-window"><div className="recommendation-track">{Array.from({ length: Math.min(4, recommended.length) }, (_, offset) => { const item = recommended[(recIndex + offset) % recommended.length]; return <Link key={`${item.id}-${recIndex}-${offset}`} href={`/product/${item.id}`} className="recommendation-card"><div className="recommendation-image"><img src={item.images[0]} alt={cleanTitle(item.catalogName || item.name)} /></div><div className="recommendation-meta"><strong>{cleanTitle(item.catalogName || item.name)}</strong><span>{money(item.price, item.currency)}</span></div></Link>; })}</div></div></section>}
    <footer className="detail-footer"><span>MATERIAL CATALOG / 01</span><span>ITEM FILE CLOSED</span></footer>
  </div>;
}
