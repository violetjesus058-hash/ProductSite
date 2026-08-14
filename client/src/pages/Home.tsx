// Editorial Pinboard reminder: the homepage is a browsable catalog wall, not a centered storefront; images lead, copy follows.
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, ChevronDown, Grid2X2, Heart, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { products, categoryLabels, categoryOrder } from "@/data/products";

function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }

const navItems = [
  { id: "all", label: "全部", count: products.length },
  ...categoryOrder.slice(1).map((id) => ({ id, label: categoryLabels[id], count: products.filter((p) => p.category === id).length })),
];

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export default function Home() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("curated");
  const [favorites, setFavorites] = useState<string[]>([]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const haystack = [product.name, product.catalogName, product.brand, product.subCategory].join(" ").toLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
    return [...filtered].sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : a.id.localeCompare(b.id));
  }, [category, query, sort]);

  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="catalog-shell">
      <aside className="catalog-rail">
        <button className="brand-lockup" onClick={() => { setCategory("all"); setQuery(""); }} aria-label="回到全部商品">
          <img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" className="brand-mark" />
          <span className="brand-type">MATERIAL<br /><em>CATALOG</em></span>
        </button>
        <div className="rail-rule" />
        <div className="rail-kicker">BROWSE BY</div>
        <nav className="category-nav" aria-label="商品大类">
          {navItems.map((item) => (
            <button key={item.id} className={`category-link ${category === item.id ? "is-active" : ""}`} onClick={() => setCategory(item.id)}>
              <span>{item.label}</span><small>{String(item.count).padStart(2, "0")}</small>
            </button>
          ))}
        </nav>
        <div className="rail-footer"><span>CATALOG / 01</span><span>2026</span></div>
      </aside>

      <main className="catalog-main">
        <header className="catalog-header">
          <div className="mobile-brand"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" /> <span>Material Catalog</span></div>
          <div className="search-wrap"><Search size={17} strokeWidth={1.8} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索品牌、商品或品类" aria-label="搜索商品" />{query && <button onClick={() => setQuery("")}>清除</button>}</div>
          <div className="header-actions"><button className="header-icon" aria-label="筛选"><SlidersHorizontal size={18} /></button><button className="header-icon" aria-label="网格视图"><Grid2X2 size={18} /></button><span className="profile-dot">M</span></div>
        </header>
        <section className="catalog-intro">
          <div><div className="eyebrow"><Sparkles size={13} /> EDITED GOODS / 01</div><h1>Find the next<br /><i>piece.</i></h1></div>
          <div className="intro-note">精选服饰与生活方式单品。<br />点击图片，打开商品档案。</div>
        </section>
        <div className="catalog-toolbar"><div className="result-label"><span className="coral-dot" /> {category === "all" ? "全部商品" : categoryLabels[category]} <strong>{visible.length}</strong></div><label className="sort-select">排序 <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="curated">编辑精选</option><option value="price-low">价格从低到高</option><option value="price-high">价格从高到低</option></select><ChevronDown size={14} /></label></div>
        {visible.length > 0 ? <section className="masonry-grid" aria-label="商品列表">{visible.map((product, index) => {
          const image = product.images[0];
          const isFav = favorites.includes(product.id);
          return <article className={`product-card card-${index % 7}`} key={product.id} onClick={() => navigate(`/product/${product.id}`)}>
            <div className="product-image-wrap"><img src={image} alt={product.catalogName || product.name} loading={index < 8 ? "eager" : "lazy"} /><div className="image-wash" /><button className={`favorite-button ${isFav ? "is-favorite" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }} aria-label={isFav ? "取消收藏" : "收藏商品"}><Heart size={16} fill={isFav ? "currentColor" : "none"} /></button><span className="view-stamp">VIEW FILE <ArrowUpRight size={14} /></span></div>
            <div className="product-meta"><div className="product-name">{cleanTitle(product.catalogName || product.name)}</div><div className="product-sub"><span>{product.brand || product.subCategory || "CATALOG ITEM"}</span><strong>{money(product.price, product.currency)}</strong></div></div>
          </article>;
        })}</section> : <div className="empty-state"><span>NO MATCHES / 00</span><h2>换一个关键词试试。</h2><button onClick={() => { setQuery(""); setCategory("all"); }}>清除筛选</button></div>}
      </main>
    </div>
  );
}
