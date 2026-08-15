// Editorial Pinboard reminder: the homepage is a browsable catalog wall, not a centered storefront; images lead, copy follows.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, Bell, ChevronDown, Heart, History as HistoryIcon, Home as HomeIcon, MessageCircle, Search, Settings2, X } from "lucide-react";
import { products, categoryLabels, categoryOrder } from "@/data/products";
import { formatVisitTime, readFavorites, readHistory, saveFavorites, type HistoryEntry } from "@/lib/catalogMemory";

function englishValue(value: string, fallback: string) { return /[\u4e00-\u9fff]/.test(value) ? fallback : value; }
function localSetting(key: string, fallback: string) { if (typeof window === "undefined") return fallback; return window.localStorage.getItem(key) || fallback; }
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
const englishCategoryLabels: Record<string, string> = { all: "ALL PRODUCTS", clothing: "CLOTHING", shoe: "SHOES", pants: "PANTS", ACC: "ACCESSORIES", watches: "WATCHES" };
const navItems = [
  { id: "all", label: englishCategoryLabels.all, count: products.length },
  ...categoryOrder.slice(1).map((id) => ({ id, label: englishCategoryLabels[id] || id.toUpperCase(), count: products.filter((p) => p.category === id).length })),
];
function money(value: number, currency = "USD") { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
const averageCatalogPrice = products.reduce((sum, product) => sum + product.price, 0) / Math.max(products.length, 1);
function demoBadge(price: number) {
  if (price <= averageCatalogPrice * 0.65 || price >= averageCatalogPrice * 1.6) return "NEW";
  if (price >= averageCatalogPrice * 0.85 && price <= averageCatalogPrice * 1.15) return "200+ SOLD";
  return "";
}
function isCuratedCategory(product: (typeof products)[number]) {
  const text = [product.subCategory, product.name, product.catalogName, product.brand].filter(Boolean).join(" ").toLowerCase();
  return product.category === "shoe" || product.category === "watches" || (product.category === "ACC" && /(wallet|purse|bag|fragrance|perfume|cologne|香水|钱包)/i.test(text));
}

export default function Home() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("curated");
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());
  const [openPanel, setOpenPanel] = useState<"favorites" | "history" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subCategory, setSubCategory] = useState("all");
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  const [recommendationCount, setRecommendationCount] = useState(24);
  const recommendationSentinel = useRef<HTMLDivElement | null>(null);
  const [pageStyle, setPageStyle] = useState(() => localSetting("material-catalog:style", "default"));
  const [fontSizeLevel, setFontSizeLevel] = useState(() => Number(localSetting("material-catalog:font-size", "0")));
  const [letterSpacingLevel, setLetterSpacingLevel] = useState(() => Number(localSetting("material-catalog:letter-spacing", "0")));
  useEffect(() => saveFavorites(favorites), [favorites]);
  useEffect(() => { window.localStorage.setItem("material-catalog:style", pageStyle); }, [pageStyle]);
  useEffect(() => { window.localStorage.setItem("material-catalog:font-size", String(fontSizeLevel)); }, [fontSizeLevel]);
  useEffect(() => { window.localStorage.setItem("material-catalog:letter-spacing", String(letterSpacingLevel)); }, [letterSpacingLevel]);
  const [demoViewers] = useState(() => Math.floor(Math.random() * 151) + 150);
  const brandItems = useMemo(() => {
    const scoped = category === "all" ? products : products.filter((product) => product.category === category);
    const counts = new Map<string, number>();
    scoped.forEach((product) => { if (product.brand) counts.set(product.brand, (counts.get(product.brand) || 0) + 1); });
    return [{ id: "all", label: "ALL BRANDS", count: scoped.length }, ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([id, count]) => ({ id, label: id, count }))];
  }, [category]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesBrand = brand === "all" || product.brand === brand;
      const matchesSubCategory = subCategory === "all" || product.subCategory === subCategory;
      const haystack = [product.name, product.catalogName, product.brand, product.subCategory].join(" ").toLowerCase();
      return matchesCategory && matchesBrand && matchesSubCategory && (!term || haystack.includes(term));
    });
    return [...filtered].sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : a.id.localeCompare(b.id));
  }, [brand, category, query, sort, subCategory]);
  const needsCuration = visible.length <= 8;
  const lowPriceProducts = useMemo(() => {
    const visibleIds = new Set(visible.map((item) => item.id));
    const matchesScope = (item: (typeof products)[number]) => !visibleIds.has(item.id) && (brand === "all" || item.brand === brand) && (category === "all" || item.category === category) && (subCategory === "all" || item.subCategory === subCategory);
    const scoped = products.filter(matchesScope);
    const sameBrand = products.filter((item) => !visibleIds.has(item.id) && brand !== "all" && item.brand === brand);
    const sameCategory = products.filter((item) => !visibleIds.has(item.id) && category !== "all" && item.category === category);
    const pool = scoped.length >= 4 ? scoped : sameBrand.length >= 4 ? sameBrand : sameCategory.length >= 4 ? sameCategory : products.filter((item) => !visibleIds.has(item.id));
    return [...pool].sort(() => Math.random() - 0.5);
  }, [brand, category, subCategory, visible]);
  useEffect(() => { setRecommendationCount(24); }, [brand, category, subCategory, query, sort]);
  useEffect(() => { const node = recommendationSentinel.current; if (!node || lowPriceProducts.length === 0) return; const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) setRecommendationCount((count) => count + 24); }, { rootMargin: "700px" }); observer.observe(node); return () => observer.disconnect(); }, [lowPriceProducts.length, recommendationCount]);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const favoriteProducts = favorites.map((id) => products.find((item) => item.id === id)).filter(Boolean) as typeof products;
  const historyProducts = history.map((entry) => ({ entry, product: products.find((item) => item.id === entry.id) })).filter((item) => item.product) as { entry: HistoryEntry; product: (typeof products)[number] }[];
  const subCategoryItems = useMemo(() => { const scoped = category === "all" ? products : products.filter((product) => product.category === category); const counts = new Map<string, number>(); scoped.forEach((product) => { if (product.subCategory) counts.set(product.subCategory, (counts.get(product.subCategory) || 0) + 1); }); const values = Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b)); return ["all", ...values]; }, [category]);
  const resetFilters = () => { setCategory("all"); setBrand("all"); setSubCategory("all"); setQuery(""); };

  return <div className={`catalog-shell catalog-style-${pageStyle} type-size-${fontSizeLevel} tracking-level-${letterSpacingLevel}`}>
    <nav className="mobile-icon-rail" aria-label="Mobile categories"><button className={category === "all" ? "is-active" : ""} onClick={() => { setCategory("all"); setBrand("all"); setSubCategory("all"); }} aria-label="All products"><HomeIcon size={17} /><span>ALL</span></button>{navItems.slice(1).map((item) => <button key={item.id} className={category === item.id ? "is-active" : ""} onClick={() => { setCategory(item.id); setBrand("all"); setSubCategory("all"); }} aria-label={item.label}><span>{item.id === "ACC" ? "ACC" : item.label.slice(0, 5)}</span></button>)}<button aria-label="Saved items" onClick={() => setOpenPanel("favorites")}><Heart size={17} /></button><button aria-label="Display settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></button><button className={`mobile-expand-button ${subCategoryOpen ? "is-active" : ""}`} aria-label="Expand subcategories" aria-expanded={subCategoryOpen} onClick={() => setSubCategoryOpen((open) => !open)}><ChevronDown size={16} /><span>MORE</span></button>{subCategoryOpen && <div className="mobile-subcategory-panel"><div className="mobile-subcategory-head"><strong>{category === "all" ? "ALL CATEGORIES" : englishCategoryLabels[category]}</strong><button onClick={() => setSubCategoryOpen(false)} aria-label="Close subcategories"><X size={14} /></button></div>{subCategoryItems.map((item) => <button key={item} className={subCategory === item ? "is-selected" : ""} onClick={() => { setSubCategory(item); setSubCategoryOpen(false); }}>{item === "all" ? "ALL SUBCATEGORIES" : englishValue(item, "SUBCATEGORY")}</button>)}</div>}</nav>
    <aside className="catalog-rail">
      <button className="brand-lockup" onClick={resetFilters} aria-label="Back to ALL PRODUCTS"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" className="brand-mark" /><span className="brand-type">MATERIAL<br /><em>CATALOG</em></span></button>
      <div className="rail-rule" /><div className="rail-kicker">BROWSE BY</div>
      <nav className="category-nav" aria-label="Product categories">
        {navItems.map((item) => <button key={item.id} className={`category-link ${category === item.id ? "is-active" : ""}`} onClick={() => { setCategory(item.id); setBrand("all"); setSubCategory("all"); }}><span>{item.label}</span></button>)}
      </nav>
      <div className="rail-rule brand-rule" /><div className="rail-kicker brand-kicker">BRANDS</div>
      <nav className="brand-nav" aria-label="Brand selection">
        {brandItems.map((item) => <button key={item.id} className={`brand-link ${brand === item.id ? "is-active" : ""}`} onClick={() => setBrand(item.id)}><span>{englishValue(item.label, "BRAND")}</span></button>)}
      </nav>
      <div className="rail-footer"><span>CATALOG / 01</span><span>2026</span></div>
    </aside>
    <main className="catalog-main">
      <header className="catalog-header"><div className="mobile-brand"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" /> <span>Material Catalog</span></div><div className="search-wrap"><Search size={17} strokeWidth={1.8} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands, products, or categories" aria-label="Search products" />{query && <button onClick={() => setQuery("")}>Clear</button>}</div><div className="header-actions"><div className="header-menu"><button className={`header-icon header-record-button ${openPanel === "favorites" ? "is-active" : ""}`} aria-label={`Saved items, ${favoriteProducts.length}`} aria-expanded={openPanel === "favorites"} onClick={() => setOpenPanel(openPanel === "favorites" ? null : "favorites")}><Heart size={18} fill={favoriteProducts.length ? "currentColor" : "none"} /><span>{favoriteProducts.length}</span></button>{openPanel === "favorites" && <div className="record-popover"><div className="record-popover-head"><strong>SAVED ITEMS</strong><button onClick={() => setOpenPanel(null)} aria-label="Close saved items"><X size={15} /></button></div>{favoriteProducts.length ? favoriteProducts.map((product) => <button className="record-row" key={product.id} onClick={() => navigate(`/product/${product.id}`)}><img src={product.images[0]} alt="" /><span><strong>{cleanTitle(product.catalogName || product.name)}</strong><small>{money(product.price, product.currency)}</small></span><ArrowUpRight size={14} /></button>) : <p className="record-empty">Your saved products will appear here.</p>}</div>}</div><div className="header-menu"><button className={`header-icon header-record-button ${openPanel === "history" ? "is-active" : ""}`} aria-label={`Browsing history, ${historyProducts.length}`} aria-expanded={openPanel === "history"} onClick={() => { setHistory(readHistory()); setOpenPanel(openPanel === "history" ? null : "history"); }}><HistoryIcon size={18} /><span>{historyProducts.length}</span></button>{openPanel === "history" && <div className="record-popover"><div className="record-popover-head"><strong>BROWSING HISTORY</strong><button onClick={() => setOpenPanel(null)} aria-label="Close browsing history"><X size={15} /></button></div>{historyProducts.length ? historyProducts.map(({ entry, product }) => <button className="record-row" key={product.id} onClick={() => navigate(`/product/${product.id}`)}><img src={product.images[0]} alt="" /><span><strong>{cleanTitle(product.catalogName || product.name)}</strong><small>Viewed {formatVisitTime(entry.visitedAt)}</small></span><ArrowUpRight size={14} /></button>) : <p className="record-empty">Products you open will appear here.</p>}</div>}</div><span className="live-status"><i /> <span className="demo-label">Demo</span> · Browsing {demoViewers} · Historical visits 20K+</span></div></header>
      <div className="catalog-toolbar"><div className="result-label"><span className="coral-dot" /> {brand !== "all" ? englishValue(brand, "SELECTED BRAND") : category === "all" ? "ALL PRODUCTS" : englishCategoryLabels[category] || category.toUpperCase()}</div><label className="sort-select">Sort <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="curated">Curated</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select><ChevronDown size={14} /></label></div>
      {visible.length > 0 ? <>
        <section className="masonry-grid" aria-label="Product list">
          {visible.map((product, index) => { const image = product.images[0]; const isFav = favorites.includes(product.id); const title = englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`); const note = product.subCategory ? `Catalog observation: ${englishValue(product.subCategory, "selected product format")} presentation with the listed options shown on the product page.` : "Catalog observation: product details and available options are shown on the product page."; return <Fragment key={product.id}><article className={`product-card card-${index % 7}`} onClick={() => navigate(`/product/${product.id}`)}><div className="product-image-wrap"><img src={image} alt={title} loading={index < 8 ? "eager" : "lazy"} /><div className="image-wash" />{demoBadge(product.price) && <span className={`demo-product-badge ${demoBadge(product.price) === "NEW" ? "is-new" : "is-popular"}`}>{demoBadge(product.price)}</span>}{isCuratedCategory(product) && <span className="curated-product-badge" aria-label="Curated selection">✦ CURATED</span>}<button className={`favorite-button ${isFav ? "is-favorite" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }} aria-label={isFav ? "Remove from saved items" : "Save product"}><Heart size={16} fill={isFav ? "currentColor" : "none"} /></button><span className="view-stamp">VIEW FILE <ArrowUpRight size={14} /></span></div><div className="product-meta"><div className="product-name">{title}</div><div className="product-sub"><span>{englishValue(product.brand || product.subCategory || "CATALOG ITEM", "CATALOG ITEM")}</span><strong>{money(product.price, product.currency)}</strong></div></div></article>{(index + 1) % 7 === 0 && <article className="editorial-note-card" role="link" tabIndex={0} onClick={() => navigate(`/product/${product.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/product/${product.id}`); }}><div className="editorial-note-mark">FIELD NOTE</div><div className="editorial-note-title">{title}</div><p>{note}</p><span>Open product <ArrowUpRight size={13} /></span></article>}</Fragment>; })}
        </section>
        {lowPriceProducts.length > 0 && <section className="low-price-extension"><div className="low-price-extension-top"><div className="low-price-extension-label">MORE TO EXPLORE</div></div><div className="low-price-grid">{Array.from({ length: recommendationCount }, (_, index) => { const product = lowPriceProducts[index % lowPriceProducts.length]; return <article className={`product-card card-${(index + 3) % 7}`} key={`low-${product.id}-${index}`} onClick={() => navigate(`/product/${product.id}`)}><div className="product-image-wrap"><img src={product.images[0]} alt={englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)} loading="lazy" /><div className="image-wash" />{demoBadge(product.price) && <span className={`demo-product-badge ${demoBadge(product.price) === "NEW" ? "is-new" : "is-popular"}`}>{demoBadge(product.price)}</span>}{isCuratedCategory(product) && <span className="curated-product-badge" aria-label="Curated selection">✦ CURATED</span>}</div><div className="product-meta"><div className="product-name">{englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`)}</div><div className="product-sub"><span>{englishValue(product.brand || product.subCategory || "CATALOG ITEM", "CATALOG ITEM")}</span><strong>{money(product.price, product.currency)}</strong></div></div></article>; })}</div><div ref={recommendationSentinel} className="recommendation-sentinel" aria-hidden="true" /></section>}
      </> : <div className="empty-state"><span>NO MATCHES / 00</span><h2>Try another search.</h2><button onClick={resetFilters}>Clear filters</button></div>}
      <button className="mobile-settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Open display settings"><Settings2 size={19} /></button>
      {settingsOpen && <div className="mobile-settings-backdrop" onClick={() => setSettingsOpen(false)}><section className="mobile-settings-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="display-settings-title"><div className="mobile-settings-head"><div><span className="mobile-discovery-kicker">DISPLAY</span><h2 id="display-settings-title">Catalog settings</h2></div><button onClick={() => setSettingsOpen(false)} aria-label="Close display settings"><X size={18} /></button></div><div className="settings-group"><span className="settings-label">PAGE STYLE</span><div className="style-options">{[["default", "Default"], ["white", "White"], ["gray", "Gray"], ["black", "Black"], ["green", "Soft green"]].map(([value, label]) => <button key={value} className={pageStyle === value ? "is-selected" : ""} onClick={() => setPageStyle(value)}>{label}</button>)}</div></div><label className="settings-range"><span><strong>Font size</strong><small>{fontSizeLevel === 0 ? "Small" : fontSizeLevel === 1 ? "Medium" : "Large"}</small></span><input type="range" min="0" max="2" step="1" value={fontSizeLevel} onChange={(event) => setFontSizeLevel(Number(event.target.value))} /></label><label className="settings-range"><span><strong>Letter spacing</strong><small>{letterSpacingLevel === 0 ? "Tight" : letterSpacingLevel === 1 ? "Balanced" : "Open"}</small></span><input type="range" min="0" max="2" step="1" value={letterSpacingLevel} onChange={(event) => setLetterSpacingLevel(Number(event.target.value))} /></label></section></div>}
    </main>
  </div>;
}
