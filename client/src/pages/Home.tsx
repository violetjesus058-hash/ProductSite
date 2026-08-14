// Editorial Pinboard reminder: the homepage is a browsable catalog wall, not a centered storefront; images lead, copy follows.
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, ChevronDown, Grid2X2, Heart, Search, SlidersHorizontal } from "lucide-react";
import { products, categoryLabels, categoryOrder } from "@/data/products";

function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
const navItems = [
  { id: "all", label: "全部", count: products.length },
  ...categoryOrder.slice(1).map((id) => ({ id, label: categoryLabels[id], count: products.filter((p) => p.category === id).length })),
];
function money(value: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }

export default function Home() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("curated");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [demoViewers] = useState(() => Math.floor(Math.random() * 151) + 150);
  const brandItems = useMemo(() => {
    const scoped = category === "all" ? products : products.filter((product) => product.category === category);
    const counts = new Map<string, number>();
    scoped.forEach((product) => { if (product.brand) counts.set(product.brand, (counts.get(product.brand) || 0) + 1); });
    return [{ id: "all", label: "全部品牌", count: scoped.length }, ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([id, count]) => ({ id, label: id, count }))];
  }, [category]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesBrand = brand === "all" || product.brand === brand;
      const haystack = [product.name, product.catalogName, product.brand, product.subCategory].join(" ").toLowerCase();
      return matchesCategory && matchesBrand && (!term || haystack.includes(term));
    });
    return [...filtered].sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : a.id.localeCompare(b.id));
  }, [brand, category, query, sort]);
  const lowPriceProducts = useMemo(() => {
    if (visible.length > 4) return [];
    const visibleIds = new Set(visible.map((item) => item.id));
    const scoped = products.filter((item) => !visibleIds.has(item.id) && (brand === "all" || item.brand === brand) && (category === "all" || item.category === category));
    const sameBrand = products.filter((item) => !visibleIds.has(item.id) && brand !== "all" && item.brand === brand);
    const sameCategory = products.filter((item) => !visibleIds.has(item.id) && category !== "all" && item.category === category);
    const pool = scoped.length >= 4 ? scoped : sameBrand.length >= 4 ? sameBrand : sameCategory.length >= 4 ? sameCategory : products.filter((item) => !visibleIds.has(item.id));
    return [...pool].sort((a, b) => a.price - b.price).slice(0, 8);
  }, [brand, category, visible]);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const resetFilters = () => { setCategory("all"); setBrand("all"); setQuery(""); };

  return <div className="catalog-shell">
    <aside className="catalog-rail">
      <button className="brand-lockup" onClick={resetFilters} aria-label="回到全部商品"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" className="brand-mark" /><span className="brand-type">MATERIAL<br /><em>CATALOG</em></span></button>
      <div className="rail-rule" /><div className="rail-kicker">BROWSE BY</div>
      <nav className="category-nav" aria-label="商品大类">
        {navItems.map((item) => <button key={item.id} className={`category-link ${category === item.id ? "is-active" : ""}`} onClick={() => { setCategory(item.id); setBrand("all"); }}><span>{item.label}</span></button>)}
      </nav>
      <div className="rail-rule brand-rule" /><div className="rail-kicker brand-kicker">BRANDS</div>
      <nav className="brand-nav" aria-label="品牌选择">
        {brandItems.map((item) => <button key={item.id} className={`brand-link ${brand === item.id ? "is-active" : ""}`} onClick={() => setBrand(item.id)}><span>{item.label}</span></button>)}
      </nav>
      <div className="rail-footer"><span>CATALOG / 01</span><span>2026</span></div>
    </aside>
    <main className="catalog-main">
      <header className="catalog-header"><div className="mobile-brand"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" /> <span>Material Catalog</span></div><div className="search-wrap"><Search size={17} strokeWidth={1.8} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索品牌、商品或品类" aria-label="搜索商品" />{query && <button onClick={() => setQuery("")}>清除</button>}</div><div className="header-actions"><button className="header-icon" aria-label="筛选"><SlidersHorizontal size={18} /></button><button className="header-icon" aria-label="网格视图"><Grid2X2 size={18} /></button><span className="live-status"><i /> <span className="demo-label">演示数据</span> · 正在浏览 {demoViewers} · 历史访问 2w+</span></div></header>
      <div className="catalog-toolbar"><div className="result-label"><span className="coral-dot" /> {brand !== "all" ? brand : category === "all" ? "全部商品" : categoryLabels[category]}</div><label className="sort-select">排序 <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="curated">编辑精选</option><option value="price-low">价格从低到高</option><option value="price-high">价格从高到低</option></select><ChevronDown size={14} /></label></div>
      {visible.length > 0 ? <>
        <section className="masonry-grid" aria-label="商品列表">
          {visible.map((product, index) => { const image = product.images[0]; const isFav = favorites.includes(product.id); return <article className={`product-card card-${index % 7}`} key={product.id} onClick={() => navigate(`/product/${product.id}`)}><div className="product-image-wrap"><img src={image} alt={product.catalogName || product.name} loading={index < 8 ? "eager" : "lazy"} /><div className="image-wash" /><button className={`favorite-button ${isFav ? "is-favorite" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }} aria-label={isFav ? "取消收藏" : "收藏商品"}><Heart size={16} fill={isFav ? "currentColor" : "none"} /></button><span className="view-stamp">VIEW FILE <ArrowUpRight size={14} /></span></div><div className="product-meta"><div className="product-name">{cleanTitle(product.catalogName || product.name)}</div><div className="product-sub"><span>{product.brand || product.subCategory || "CATALOG ITEM"}</span><strong>{money(product.price, product.currency)}</strong></div></div></article>; })}
        </section>
        {visible.length <= 4 && <div className="curation-note"><span className="curation-note-mark">✦</span><div><strong>正在高标准选择高质量的产品</strong><p>我们会持续筛选更值得加入目录的商品，敬请期待。</p></div></div>}
        {lowPriceProducts.length > 0 && <section className="low-price-extension"><div className="low-price-extension-label">MORE TO EXPLORE</div><div className="low-price-grid">{lowPriceProducts.map((product, index) => <article className={`product-card card-${(index + 3) % 7}`} key={`low-${product.id}`} onClick={() => navigate(`/product/${product.id}`)}><div className="product-image-wrap"><img src={product.images[0]} alt={product.catalogName || product.name} loading="lazy" /><div className="image-wash" /></div><div className="product-meta"><div className="product-name">{cleanTitle(product.catalogName || product.name)}</div><div className="product-sub"><span>{product.brand || product.subCategory || "CATALOG ITEM"}</span><strong>{money(product.price, product.currency)}</strong></div></div></article>)}</div></section>}
      </> : <div className="empty-state"><span>NO MATCHES / 00</span><h2>换一个关键词试试。</h2><button onClick={resetFilters}>清除筛选</button></div>}
    </main>
  </div>;
}
