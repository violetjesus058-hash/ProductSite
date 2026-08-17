// Editorial Pinboard reminder: the homepage is a browsable catalog wall, not a centered storefront; images lead, copy follows.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, Bell, ChevronDown, Heart, History as HistoryIcon, Home as HomeIcon, MessageCircle, Search, Settings2, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { products, categoryLabels, categoryOrder } from "@/data/products";
import { formatVisitTime, readFavorites, readHistory, saveFavorites, type HistoryEntry } from "@/lib/catalogMemory";

// Editorial Pinboard audit view: compact evidence-first cards, restrained motion, and sequential category handoff after a category is fully reviewed.

function englishValue(value: string, fallback: string) { return /[\u4e00-\u9fff]/.test(value) ? fallback : value; }
function localSetting(key: string, fallback: string) { if (typeof window === "undefined") return fallback; return window.localStorage.getItem(key) || fallback; }
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
const englishCategoryLabels: Record<string, string> = { all: "ALL PRODUCTS", clothing: "CLOTHING", shoe: "SHOES", pants: "PANTS", bags: "BAGS", fragrance: "FRAGRANCE", ACC: "ACCESSORIES", watches: "WATCHES" };
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

// Simple seeded random for stable shuffle within a batch
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const AUDIT_SESSION_KEY = "audit:session:v2";
type AuditSession = {
  category: string;
  brand: string;
  subCategory: string;
  query: string;
  sort: string;
  shuffleSeed: number;
  pageSize: number;
  isAiAuditView: boolean;
  batchSourceIds: string[];
  updatedAt: number;
};

function readAuditSession(): AuditSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUDIT_SESSION_KEY);
    const fallbackCategory = window.localStorage.getItem("audit:last-category");
    const fallbackAuditMode = window.localStorage.getItem("audit:audit-mode") === "1";
    if (!raw) {
      if (!fallbackCategory || !fallbackAuditMode) return null;
      return { category: categoryOrder.includes(fallbackCategory) ? fallbackCategory : "clothing", brand: "all", subCategory: "all", query: "", sort: "random", shuffleSeed: Date.now(), pageSize: 80, isAiAuditView: true, batchSourceIds: [], updatedAt: Date.now() };
    }
    const parsed = JSON.parse(raw) as Partial<AuditSession>;
    if (!parsed || typeof parsed !== "object") return null;
    const validCategory = typeof parsed.category === "string" && (parsed.category === "all" || categoryOrder.includes(parsed.category));
    return {
      category: validCategory ? parsed.category! : "clothing",
      brand: typeof parsed.brand === "string" ? parsed.brand : "all",
      subCategory: typeof parsed.subCategory === "string" ? parsed.subCategory : "all",
      query: typeof parsed.query === "string" ? parsed.query : "",
      sort: typeof parsed.sort === "string" ? parsed.sort : "random",
      shuffleSeed: typeof parsed.shuffleSeed === "number" ? parsed.shuffleSeed : Date.now(),
      pageSize: typeof parsed.pageSize === "number" ? parsed.pageSize : 80,
      isAiAuditView: parsed.isAiAuditView !== false,
      batchSourceIds: Array.isArray(parsed.batchSourceIds) ? parsed.batchSourceIds.filter((id): id is string => typeof id === "string") : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const [, navigate] = useLocation();
  const [auditSession] = useState<AuditSession | null>(() => readAuditSession());
  const [category, setCategory] = useState(() => auditSession?.category || "clothing"); // Resume the last audit category after regeneration
  const [brand, setBrand] = useState(() => auditSession?.brand || "all");
  const [query, setQuery] = useState(() => auditSession?.query || "");
  const [sort, setSort] = useState(() => auditSession?.sort || "random"); // Keep the audit shuffle stable across reloads
    const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());
  const [openPanel, setOpenPanel] = useState<"favorites" | "history" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subCategory, setSubCategory] = useState(() => auditSession?.subCategory || "all");
  const [subCategoryOpen, setSubCategoryOpen] = useState(false);
  
  // Audit Mode State
  const [seenIds, setSeenIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("audit:seen-ids");
    return saved ? JSON.parse(saved) : [];
  });
  const [shuffleSeed, setShuffleSeed] = useState(() => auditSession?.shuffleSeed || Date.now());
  const [pageSize, setPageSize] = useState(() => auditSession?.pageSize || 40);
  const [isAiAuditView, setIsAiAuditView] = useState(() => auditSession?.isAiAuditView || false);
  const reviewKey = (product: (typeof products)[number]) => product.sourceProductId || product.id;
  const isReviewed = (product: (typeof products)[number]) => seenIds.includes(reviewKey(product));
  const changeAuditCategory = (nextCategory: string) => {
    setCategory(nextCategory);
    setBrand("all");
    setSubCategory("all");
    if (isAiAuditView && nextCategory !== "all") {
      window.localStorage.setItem("audit:last-category", nextCategory);
      window.localStorage.setItem("audit:audit-mode", "1");
    }
  };

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
      const isNotSeen = !isReviewed(product);
      const haystack = [product.name, product.catalogName, product.brand, product.subCategory].join(" ").toLowerCase();
      return matchesCategory && matchesBrand && matchesSubCategory && isNotSeen && (!term || haystack.includes(term));
    });

    let result = [...filtered];
    if (sort === "random") {
      // Seeded shuffle for stability within the same seed
      let currentSeed = shuffleSeed;
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(currentSeed++) * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
    } else if (sort === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else {
      result.sort((a, b) => a.id.localeCompare(b.id));
    }
    
    return result.slice(0, pageSize);
  }, [brand, category, query, sort, subCategory, seenIds, shuffleSeed, pageSize]);

  // Persist the complete audit cursor. The shuffle seed is the batch cursor: after data regeneration,
  // the same seed plus the same seen source IDs recreates the unfinished batch instead of restarting Clothing.
  useEffect(() => {
    if (!isAiAuditView || category === "all") return;
    window.localStorage.setItem("audit:last-category", category);
    window.localStorage.setItem("audit:audit-mode", "1");
    const session: AuditSession = {
      category,
      brand,
      subCategory,
      query,
      sort,
      shuffleSeed,
      pageSize,
      isAiAuditView,
      batchSourceIds: visible.map(reviewKey),
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(AUDIT_SESSION_KEY, JSON.stringify(session));
  }, [brand, category, isAiAuditView, pageSize, query, seenIds, shuffleSeed, sort, subCategory, visible]);

  const totalRemainingInCategory = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = category === "all" || p.category === category;
      const isNotSeen = !isReviewed(p);
      return matchesCategory && isNotSeen;
    }).reduce((keys, product) => keys.add(reviewKey(product)), new Set<string>()).size;
  }, [category, seenIds]);

  // Once a category has no unseen records, move the audit view to the next category with remaining records.
  useEffect(() => {
    if (!isAiAuditView || category === "all" || totalRemainingInCategory > 0) return;
    const nextCategory = categoryOrder
      .filter((id) => id !== "all" && id !== category)
      .find((id) => products.some((product) => product.category === id && !isReviewed(product)));
    if (nextCategory) {
      setCategory(nextCategory);
      setBrand("all");
      setSubCategory("all");
      setShuffleSeed(Date.now());
    }
  }, [category, isAiAuditView, seenIds, totalRemainingInCategory]);

  const markPageAsSeen = () => {
    const newSeen = Array.from(new Set([...seenIds, ...visible.map(reviewKey)]));
    setSeenIds(newSeen);
    localStorage.setItem("audit:seen-ids", JSON.stringify(newSeen));
    setShuffleSeed(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetAuditProgress = () => {
    if (confirm("Are you sure you want to reset audit progress? This will clear all 'seen' records.")) {
      setSeenIds([]);
      localStorage.removeItem("audit:seen-ids");
      setShuffleSeed(Date.now());
    }
  };

  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [brand, category, subCategory, query, sort]);

  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const favoriteProducts = favorites.map((id) => products.find((item) => item.id === id)).filter(Boolean) as typeof products;
  const historyProducts = history.map((entry) => ({ entry, product: products.find((item) => item.id === entry.id) })).filter((item) => item.product) as { entry: HistoryEntry; product: (typeof products)[number] }[];
  const subCategoryItems = useMemo(() => { const scoped = category === "all" ? products : products.filter((product) => product.category === category); const counts = new Map<string, number>(); scoped.forEach((product) => { if (product.subCategory) counts.set(product.subCategory, (counts.get(product.subCategory) || 0) + 1); }); const values = Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b)); return ["all", ...values]; }, [category]);
  const resetFilters = () => { setCategory("all"); setBrand("all"); setSubCategory("all"); setQuery(""); };

  return <div className={`catalog-shell catalog-style-${pageStyle} type-size-${fontSizeLevel} tracking-level-${letterSpacingLevel}`}>
    <nav className="mobile-icon-rail" aria-label="Mobile categories"><button className={category === "all" ? "is-active" : ""} onClick={() => changeAuditCategory("all")} aria-label="All products"><HomeIcon size={17} /><span>ALL</span></button>{navItems.slice(1).map((item) => <button key={item.id} className={category === item.id ? "is-active" : ""} onClick={() => changeAuditCategory(item.id)} aria-label={item.label}><span>{item.id === "ACC" ? "ACC" : item.label.slice(0, 5)}</span></button>)}<button aria-label="Saved items" onClick={() => setOpenPanel("favorites")}><Heart size={17} /></button><button aria-label="Display settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></button><button className={`mobile-expand-button ${subCategoryOpen ? "is-active" : ""}`} aria-label="Expand subcategories" aria-expanded={subCategoryOpen} onClick={() => setSubCategoryOpen((open) => !open)}><ChevronDown size={16} /><span>MORE</span></button>{subCategoryOpen && <div className="mobile-subcategory-panel"><div className="mobile-subcategory-head"><strong>{category === "all" ? "ALL CATEGORIES" : englishCategoryLabels[category]}</strong><button onClick={() => setSubCategoryOpen(false)} aria-label="Close subcategories"><X size={14} /></button></div>{subCategoryItems.map((item) => <button key={item} className={subCategory === item ? "is-selected" : ""} onClick={() => { setSubCategory(item); setSubCategoryOpen(false); }}>{item === "all" ? "ALL SUBCATEGORIES" : englishValue(item, "SUBCATEGORY")}</button>)}</div>}</nav>
    <aside className="catalog-rail">
      <button className="brand-lockup" onClick={resetFilters} aria-label="Back to ALL PRODUCTS"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" className="brand-mark" /><span className="brand-type">MATERIAL<br /><em>CATALOG</em></span></button>
      <div className="rail-rule" /><div className="rail-kicker">BROWSE BY</div>
      <nav className="category-nav" aria-label="Product categories">
        {navItems.map((item) => <button key={item.id} className={`category-link ${category === item.id ? "is-active" : ""}`} onClick={() => changeAuditCategory(item.id)}><span>{item.label}</span></button>)}
      </nav>
      <div className="rail-rule brand-rule" /><div className="rail-kicker brand-kicker">BRANDS</div>
      <nav className="brand-nav" aria-label="Brand selection">
        {brandItems.map((item) => <button key={item.id} className={`brand-link ${brand === item.id ? "is-active" : ""}`} onClick={() => setBrand(item.id)}><span>{englishValue(item.label, "BRAND")}</span></button>)}
      </nav>
      <div className="rail-footer"><span>CATALOG / 01</span><span>2026</span></div>
    </aside>
    <main className="catalog-main">
      <header className="catalog-header"><div className="mobile-brand"><img src="/manus-storage/catalog-mark_f15a35f4.png" alt="" /> <span>Material Catalog</span></div><div className="search-wrap"><Search size={17} strokeWidth={1.8} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands, products, or categories" aria-label="Search products" />{query && <button onClick={() => setQuery("")}>Clear</button>}</div><div className="header-actions"><div className="header-menu"><button className={`header-icon header-record-button ${openPanel === "favorites" ? "is-active" : ""}`} aria-label={`Saved items, ${favoriteProducts.length}`} aria-expanded={openPanel === "favorites"} onClick={() => setOpenPanel(openPanel === "favorites" ? null : "favorites")}><Heart size={18} fill={favoriteProducts.length ? "currentColor" : "none"} /><span>{favoriteProducts.length}</span></button>{openPanel === "favorites" && <div className="record-popover"><div className="record-popover-head"><strong>SAVED ITEMS</strong><button onClick={() => setOpenPanel(null)} aria-label="Close saved items"><X size={15} /></button></div>{favoriteProducts.length ? favoriteProducts.map((product) => <button className="record-row" key={product.id} onClick={() => navigate(`/product/${product.id}`)}><img src={product.images[0]} alt="" /><span><strong>{cleanTitle(product.catalogName || product.name)}</strong><small>{money(product.price, product.currency)}</small></span><ArrowUpRight size={14} /></button>) : <p className="record-empty">Your saved products will appear here.</p>}</div>}</div><div className="header-menu"><button className={`header-icon header-record-button ${openPanel === "history" ? "is-active" : ""}`} aria-label={`Browsing history, ${historyProducts.length}`} aria-expanded={openPanel === "history"} onClick={() => { setHistory(readHistory()); setOpenPanel(openPanel === "history" ? null : "history"); }}><HistoryIcon size={18} /><span>{historyProducts.length}</span></button>{openPanel === "history" && <div className="record-popover"><div className="record-popover-head"><strong>BROWSING HISTORY</strong><button onClick={() => setOpenPanel(null)} aria-label="Close browsing history"><X size={15} /></button></div>{historyProducts.length ? historyProducts.map(({ entry, product }) => <button className="record-row" key={product.id} onClick={() => navigate(`/product/${product.id}`)}><img src={product.images[0]} alt="" /><span><strong>{cleanTitle(product.catalogName || product.name)}</strong><small>Viewed {formatVisitTime(entry.visitedAt)}</small></span><ArrowUpRight size={14} /></button>) : <p className="record-empty">Products you open will appear here.</p>}</div>}</div><span className="live-status"><i /> <span className="demo-label">Demo</span> · Browsing {demoViewers} · Historical visits 20K+</span></div></header>
      
      <div className="catalog-toolbar">
        <div className="result-label">
          <span className="coral-dot" /> 
          {brand !== "all" ? englishValue(brand, "SELECTED BRAND") : category === "all" ? "ALL PRODUCTS" : englishCategoryLabels[category] || category.toUpperCase()}
          <span className="audit-counter ml-3 text-xs opacity-50">({totalRemainingInCategory} remaining)</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              const nextAuditMode = !isAiAuditView;
              setIsAiAuditView(nextAuditMode);
              setPageSize(nextAuditMode ? 80 : 40);
              window.localStorage.setItem("audit:audit-mode", nextAuditMode ? "1" : "0");
              if (nextAuditMode && category !== "all") window.localStorage.setItem("audit:last-category", category);
            }} 
            className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded border ${isAiAuditView ? "bg-black text-white border-black" : "border-black/20 opacity-60"}`}
          >
            AI Audit View
          </button>
          {seenIds.length > 0 && (
            <button onClick={resetAuditProgress} className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Reset Progress</button>
          )}
          <label className="sort-select">Sort <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="random">Random Audit</option><option value="curated">Curated</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select><ChevronDown size={14} /></label>
        </div>
      </div>

      {visible.length > 0 ? <>
        <section className={isAiAuditView ? "grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2" : "masonry-grid"} aria-label="Product list">
          {visible.map((product, index) => { 
            const image = product.images[0]; 
            const isFav = favorites.includes(product.id); 
            const title = englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`); 
            
            if (isAiAuditView) {
              return (
                <article key={product.id} className="bg-white border border-black/5 p-1 flex flex-col gap-1 cursor-pointer hover:border-black/20" onClick={() => navigate(`/product/${product.id}`)}>
                  <div className="aspect-square overflow-hidden bg-gray-50 relative">
                    <img src={image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white px-1 truncate">
                      {product.sourceProductId}
                    </div>
                  </div>
                  <div className="text-[9px] leading-tight truncate opacity-70">{title}</div>
                </article>
              );
            }
            
            return <Fragment key={product.id}><article className={`product-card card-${index % 7}`} onClick={() => navigate(`/product/${product.id}`)}><div className="product-image-wrap"><img src={image} alt={title} loading={index < 8 ? "eager" : "lazy"} /><div className="image-wash" />{demoBadge(product.price) && <span className={`demo-product-badge ${demoBadge(product.price) === "NEW" ? "is-new" : "is-popular"}`}>{demoBadge(product.price)}</span>}{product.reviewStatus === "suspected" && <span className="suspected-review-badge" aria-label="Suspected category mismatch">SUSPECTED</span>}{isCuratedCategory(product) && <span className="curated-product-badge" aria-label="Curated selection">✦ CURATED</span>}<button className={`favorite-button ${isFav ? "is-favorite" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }} aria-label={isFav ? "Remove from saved items" : "Save product"}><Heart size={16} fill={isFav ? "currentColor" : "none"} /></button><span className="view-stamp">VIEW FILE <ArrowUpRight size={10} /></span></div><div className="product-info"><div className="product-meta"><span className="product-brand">{englishValue(product.brand, "UNBRANDED")}</span><span className="product-price">{money(product.price, product.currency)}</span></div><h3 className="product-name">{title}</h3></div></article></Fragment>; 
          })}
        </section>
        
        <div className="audit-controls py-20 flex flex-col items-center justify-center border-t border-black/5 mt-20">
          <div className="text-center mb-8">
            <h4 className="text-2xl font-light tracking-tight mb-2">Batch Review Complete</h4>
            <p className="text-sm opacity-50">This batch contains {visible.length} unique source products. Mark it complete to automatically load the next unreviewed batch; {Math.max(totalRemainingInCategory - new Set(visible.map(reviewKey)).size, 0)} remain in {englishCategoryLabels[category] || category}.</p>
          </div>
          <button 
            onClick={markPageAsSeen}
            className="group relative flex items-center gap-3 px-10 py-5 bg-black text-white rounded-full hover:scale-105 transition-transform active:scale-95"
          >
            <CheckCircle2 size={20} className="text-emerald-400" />
            <span className="text-sm font-medium tracking-widest uppercase">Mark as Reviewed & Next Batch</span>
            <RefreshCw size={16} className="opacity-50 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </> : <div className="empty-state">
        <div className="empty-icon">✦</div>
        <h3>No products found</h3>
        <p>All products in this category have been reviewed or match no results.</p>
        <button onClick={resetFilters}>Clear all filters</button>
      </div>}
    </main>
    {settingsOpen && <div className="settings-overlay" onClick={() => setSettingsOpen(false)}><div className="settings-modal" onClick={(e) => e.stopPropagation()}><div className="settings-head"><strong>DISPLAY SETTINGS</strong><button onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div><div className="settings-body"><div className="settings-section"><label>PAGE STYLE</label><div className="style-grid">{["default", "white", "gray", "black", "green"].map((s) => <button key={s} className={`style-opt is-${s} ${pageStyle === s ? "is-active" : ""}`} onClick={() => setPageStyle(s)} aria-label={`Switch to ${s} style`} />)}</div></div><div className="settings-section"><label>FONT SIZE</label><input type="range" min="0" max="2" step="1" value={fontSizeLevel} onChange={(e) => setFontSizeLevel(Number(e.target.value))} /></div><div className="settings-section"><label>LETTER SPACING</label><input type="range" min="0" max="2" step="1" value={letterSpacingLevel} onChange={(e) => setLetterSpacingLevel(Number(e.target.value))} /></div></div></div></div>}
  </div>;
}
