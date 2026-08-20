// Editorial Pinboard reminder: the homepage is a browsable catalog wall, not a centered storefront; images lead, copy follows.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { ArrowUpRight, Bell, ChevronDown, Flag, Heart, History as HistoryIcon, Home as HomeIcon, MessageCircle, Search, Settings2, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { products, categoryLabels, categoryOrder } from "@/data/products";
import { formatVisitTime, readFavorites, readHistory, saveFavorites, type HistoryEntry } from "@/lib/catalogMemory";
import RequestProductDialog from "@/components/RequestProductDialog";
import SafeProductImage from "@/components/SafeProductImage";
import { buildCategoryRecommendationPool } from "@/lib/categoryRecommendations";

// Editorial Pinboard audit view: compact evidence-first cards, restrained motion, and sequential category handoff after a category is fully reviewed.

function englishValue(value: string, fallback: string) { return /[\u4e00-\u9fff]/.test(value) ? fallback : value; }
function localSetting(key: string, fallback: string) { if (typeof window === "undefined") return fallback; return window.localStorage.getItem(key) || fallback; }
function cleanTitle(value: string) { return value.replace(/📏.*$/, "").replace(/pls add whatsapp.*$/i, "").replace(/whatsapp[:：]?\s*\d+/gi, "").replace(/\s+/g, " ").trim(); }
function isSizeOnlyCardTitle(value: string) {
  const normalized = value.replace(/^[*#\s]+/, "").replace(/[：:]+$/, "").trim();
  const sizeToken = "(?:XXS|XS|S|M|L|XL|XXL|XXXL|4XL)";
  const numericRange = "\\d{2}\\s*[-–]\\s*\\d{2}";
  const sizeRange = new RegExp(`^(?:${numericRange}|${sizeToken}\\s*[-–]\\s*${sizeToken})(?:\\s+(?:${sizeToken}|\\d{2,3}[-–]\\d{2,3}kg))*$`, "i");
  const sizeWithGenericType = new RegExp(`^(?:${numericRange})(?:\\s+(?:pants|shorts|shirt|shirts|tee|t-shirt|hoodie|jacket|sweater|shoes|sneakers|apparel|clothing|selection))?$`, "i");
  return sizeRange.test(normalized) || sizeWithGenericType.test(normalized);
}
const CATALOG_RETURN_KEY = "catalog:return-context:v1";
type CatalogReturnContext = { category: string; brand: string; query: string; sort: string; scrollY: number };
function readCatalogReturnContext(): CatalogReturnContext | null { if (typeof window === "undefined") return null; try { const raw = window.sessionStorage.getItem(CATALOG_RETURN_KEY); if (!raw) return null; const parsed = JSON.parse(raw) as Partial<CatalogReturnContext>; if (!parsed || typeof parsed !== "object" || typeof parsed.category !== "string" || typeof parsed.brand !== "string" || typeof parsed.query !== "string" || typeof parsed.sort !== "string" || typeof parsed.scrollY !== "number") return null; return parsed as CatalogReturnContext; } catch { return null; } }
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
const CATEGORY_FLAG_KEY = "catalog:category-error-flags:v1";
type CategoryErrorFlag = { productId: string; sourceProductId: string; category: string; subCategory: string; flaggedAt: number };
function readCategoryErrorFlags(): Record<string, CategoryErrorFlag> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CATEGORY_FLAG_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, CategoryErrorFlag> : {};
  } catch { return {}; }
}
function writeCategoryErrorFlags(flags: Record<string, CategoryErrorFlag>) {
  if (typeof window !== "undefined") window.localStorage.setItem(CATEGORY_FLAG_KEY, JSON.stringify(flags));
}
type AuditSession = {
  category: string;
  brand: string;
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
      return { category: categoryOrder.includes(fallbackCategory) ? fallbackCategory : "clothing", brand: "all", query: "", sort: "random", shuffleSeed: Date.now(), pageSize: 80, isAiAuditView: true, batchSourceIds: [], updatedAt: Date.now() };
    }
    const parsed = JSON.parse(raw) as Partial<AuditSession>;
    if (!parsed || typeof parsed !== "object") return null;
    const validCategory = typeof parsed.category === "string" && (parsed.category === "all" || categoryOrder.includes(parsed.category));
    return {
      category: validCategory ? parsed.category! : "clothing",
      brand: typeof parsed.brand === "string" ? parsed.brand : "all",
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
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [, navigate] = useLocation();
  const [auditSession] = useState<AuditSession | null>(() => readAuditSession());
  const secondPassRequested = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("audit") === "accessories-second-pass";
  const auditResumeRequested = secondPassRequested || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("audit") === "1");
  const isAccessoriesSecondPass = secondPassRequested;
  const [returnContext] = useState(() => readCatalogReturnContext());
  // Final catalog preview opens on the complete catalog; a pending return context restores the previous catalog view.
  const [category, setCategory] = useState(() => (secondPassRequested ? "ACC" : returnContext?.category || (auditResumeRequested ? auditSession?.category || "all" : "all")));
  const [brand, setBrand] = useState(() => returnContext?.brand || auditSession?.brand || "all");
  const [query, setQuery] = useState(() => returnContext?.query || auditSession?.query || "");
  const [sort, setSort] = useState(() => returnContext?.sort || auditSession?.sort || "random"); // Keep the audit shuffle stable across reloads
    const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());
  const [categoryRecommendationCount, setCategoryRecommendationCount] = useState(24);
  const categoryRecommendationSentinel = useRef<HTMLDivElement | null>(null);
  const categoryRecommendationBusy = useRef(false);
  const [categoryErrorFlags, setCategoryErrorFlags] = useState<Record<string, CategoryErrorFlag>>(() => readCategoryErrorFlags());
  const [openPanel, setOpenPanel] = useState<"favorites" | "history" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [requestProductOpen, setRequestProductOpen] = useState(false);
  
  // Audit Mode State
  const [seenIds, setSeenIds] = useState<string[]>(() => {
    const storageKey = secondPassRequested ? "audit:accessories-second-pass-seen-ids" : "audit:seen-ids";
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  const [shuffleSeed, setShuffleSeed] = useState(() => auditSession?.shuffleSeed || Date.now());
  const [pageSize, setPageSize] = useState(() => auditSession?.pageSize || 40);
  // Final catalog preview defaults to normal browsing; AI Audit View resumes only when explicitly requested.
  const [isAiAuditView, setIsAiAuditView] = useState(() => secondPassRequested || (auditResumeRequested && auditSession?.isAiAuditView === true));
  const reviewKey = (product: (typeof products)[number]) => product.sourceProductId || product.id;
  const isReviewed = (product: (typeof products)[number]) => seenIds.includes(reviewKey(product));
  const changeAuditCategory = (nextCategory: string) => {
    if (nextCategory !== category) window.sessionStorage.removeItem(CATALOG_RETURN_KEY);
    setCategory(nextCategory);
    setBrand("all");
    if (isAiAuditView && nextCategory !== "all") {
      window.localStorage.setItem("audit:last-category", nextCategory);
      window.localStorage.setItem("audit:audit-mode", "1");
    }
  };

  const [pageStyle, setPageStyle] = useState(() => localSetting("material-catalog:style", "default"));
  const [fontSizeLevel, setFontSizeLevel] = useState(() => Number(localSetting("material-catalog:font-size", "0")));
  const [letterSpacingLevel, setLetterSpacingLevel] = useState(() => Number(localSetting("material-catalog:letter-spacing", "0")));
  
  useEffect(() => saveFavorites(favorites), [favorites]);
  useEffect(() => { writeCategoryErrorFlags(categoryErrorFlags); }, [categoryErrorFlags]);
  useEffect(() => {
    const refreshFlags = () => setCategoryErrorFlags(readCategoryErrorFlags());
    window.addEventListener("pageshow", refreshFlags);
    window.addEventListener("focus", refreshFlags);
    return () => { window.removeEventListener("pageshow", refreshFlags); window.removeEventListener("focus", refreshFlags); };
  }, []);
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

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesBrand = brand === "all" || product.brand === brand;
      const isNotSeen = isAiAuditView ? !isReviewed(product) : true;
      const haystack = [product.name, product.catalogName, product.brand, product.subCategory].join(" ").toLowerCase();
      return matchesCategory && matchesBrand && isNotSeen && (!term || haystack.includes(term));
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
    return result;
  }, [brand, category, isAiAuditView, query, sort, seenIds, shuffleSeed]);

  // Normal browsing shows the complete filtered catalog. AI Audit View intentionally keeps a compact review batch.
  const visible = isAiAuditView ? filteredProducts.slice(0, pageSize) : filteredProducts;
  const visibleSourceCount = new Set(visible.map(reviewKey)).size;

  const categoryRecommendationPool = useMemo(
    () => buildCategoryRecommendationPool(category, products, new Set(visible.map((product) => product.id))),
    [category, visible],
  );

  useEffect(() => {
    setCategoryRecommendationCount(24);
    categoryRecommendationBusy.current = false;
  }, [category, brand, query, sort]);

  useEffect(() => {
    if (isAiAuditView || categoryRecommendationPool.length === 0) return;
    const appendRecommendations = () => {
      if (categoryRecommendationBusy.current) return;
      categoryRecommendationBusy.current = true;
      setCategoryRecommendationCount((count) => count + 24);
      window.requestAnimationFrame(() => { categoryRecommendationBusy.current = false; });
    };
    const node = categoryRecommendationSentinel.current;
    const observer = node ? new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) appendRecommendations();
    }, { rootMargin: "1200px 0px" }) : null;
    if (node) observer?.observe(node);
    const onScroll = () => {
      const distanceToBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (distanceToBottom < 1200) appendRecommendations();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { observer?.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [categoryRecommendationPool.length, isAiAuditView, categoryRecommendationCount]);

  // Persist the complete audit cursor. The shuffle seed is the batch cursor: after data regeneration,
  // the same seed plus the same seen source IDs recreates the unfinished batch instead of restarting Clothing.
  useEffect(() => {
    if (!isAiAuditView || category === "all") return;
    window.localStorage.setItem("audit:last-category", category);
    window.localStorage.setItem("audit:audit-mode", "1");
    const session: AuditSession = {
      category,
      brand,
      query,
      sort,
      shuffleSeed,
      pageSize,
      isAiAuditView,
      batchSourceIds: visible.map(reviewKey),
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(AUDIT_SESSION_KEY, JSON.stringify(session));
  }, [brand, category, isAiAuditView, pageSize, query, seenIds, shuffleSeed, sort, visible]);

  const totalRemainingInCategory = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = category === "all" || p.category === category;
      const isNotSeen = !isReviewed(p);
      return matchesCategory && isNotSeen;
    }).reduce((keys, product) => keys.add(reviewKey(product)), new Set<string>()).size;
  }, [category, seenIds]);

  // Once a category has no unseen records, move the audit view to the next category with remaining records.
  useEffect(() => {
    if (!isAiAuditView || isAccessoriesSecondPass || category === "all" || totalRemainingInCategory > 0) return;
    const nextCategory = categoryOrder
      .filter((id) => id !== "all" && id !== category)
      .find((id) => products.some((product) => product.category === id && !isReviewed(product)));
    if (nextCategory) {
      setCategory(nextCategory);
      setBrand("all");
        setShuffleSeed(Date.now());
    }
  }, [category, isAiAuditView, seenIds, totalRemainingInCategory]);

  const markPageAsSeen = () => {
    const newSeen = Array.from(new Set([...seenIds, ...visible.map(reviewKey)]));
    setSeenIds(newSeen);
    const storageKey = isAccessoriesSecondPass ? "audit:accessories-second-pass-seen-ids" : "audit:seen-ids";
    localStorage.setItem(storageKey, JSON.stringify(newSeen));
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

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const shouldRestore = Boolean(returnContext && returnContext.category === category && returnContext.brand === brand && returnContext.query === query && returnContext.sort === sort);
    const targetY = shouldRestore ? Math.max(0, returnContext!.scrollY) : 0;
    let frameOne = 0;
    let frameTwo = 0;
    let restoreTimer = 0;
    const restore = () => window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    restore();
    frameOne = window.requestAnimationFrame(() => {
      restore();
      frameTwo = window.requestAnimationFrame(() => {
        restore();
        restoreTimer = window.setTimeout(restore, 120);
      });
    });
    if (shouldRestore) window.sessionStorage.removeItem(CATALOG_RETURN_KEY);
    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
      window.clearTimeout(restoreTimer);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [brand, category, query, sort, returnContext]);



  const saveReturnContext = () => { window.sessionStorage.setItem(CATALOG_RETURN_KEY, JSON.stringify({ category, brand, query, sort, scrollY: window.scrollY } satisfies CatalogReturnContext)); };
  const openProduct = (id: string) => { saveReturnContext(); navigate(`/product/${id}`); };
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const clearFavorites = () => setFavorites([]);
  const toggleCategoryErrorFlag = (product: (typeof products)[number]) => {
    setCategoryErrorFlags((current) => {
      // Merge with the latest persisted map before changing one card, so rapid clicks never replace earlier flags.
      const next = { ...readCategoryErrorFlags(), ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = { productId: product.id, sourceProductId: product.sourceProductId || product.id, category: product.category, subCategory: product.subCategory, flaggedAt: Date.now() };
      writeCategoryErrorFlags(next);
      return next;
    });
  };
  const favoriteProducts = favorites.map((id) => products.find((item) => item.id === id)).filter(Boolean) as typeof products;
  const historyProducts = history.map((entry) => ({ entry, product: products.find((item) => item.id === entry.id) })).filter((item) => item.product) as { entry: HistoryEntry; product: (typeof products)[number] }[];
  const resetFilters = () => { setCategory("all"); setBrand("all"); setQuery(""); };

  return <div className={`catalog-shell catalog-style-${pageStyle} type-size-${fontSizeLevel} tracking-level-${letterSpacingLevel}`}>
    <nav className="mobile-icon-rail" aria-label="Mobile categories"><button className={category === "all" ? "is-active" : ""} onClick={() => changeAuditCategory("all")} aria-label="All products"><HomeIcon size={17} /><span>ALL</span></button>{navItems.slice(1).map((item) => <button key={item.id} className={category === item.id ? "is-active" : ""} onClick={() => changeAuditCategory(item.id)} aria-label={item.label}><span>{item.id === "ACC" ? "ACC" : item.label.slice(0, 5)}</span></button>)}<button aria-label="Saved items" onClick={() => setOpenPanel("favorites")}><Heart size={17} /></button><button aria-label="Display settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></button></nav>
    <aside className="catalog-rail">
      <button className="brand-lockup" onClick={resetFilters} aria-label="Back to ALL PRODUCTS"><img src="/catalog-mark.webp" alt="" className="brand-mark" /><span className="brand-type">MATERIAL<br /><em>CATALOG</em></span></button>
      <div className="rail-rule" /><div className="rail-kicker">BROWSE BY</div>
      <nav className="category-nav" aria-label="Product categories">
        {navItems.map((item) => <button key={item.id} className={`category-link ${category === item.id ? "is-active" : ""}`} onClick={() => changeAuditCategory(item.id)}><span>{item.label}</span></button>)}
      </nav>
      <div className="rail-request-area"><button className="rail-request-link" onClick={() => setRequestProductOpen(true)}><span>REQUEST A PRODUCT</span><MessageCircle size={14} /></button><a className="rail-discord-link" href="https://discord.gg/jtc399kUQV" target="_blank" rel="noreferrer"><span>DISCORD FEEDBACK</span><ArrowUpRight size={12} /></a></div>
      <div className="rail-footer"><span>CATALOG / 01</span><span>2026</span></div>
    </aside>
    <main className="catalog-main">
      <header className="catalog-header"><div className="mobile-brand"><img src="/catalog-mark.webp" alt="" /> <span>Material Catalog</span></div><div className="search-wrap"><Search size={17} strokeWidth={1.8} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands, products, or categories" aria-label="Search products" />{query && <button onClick={() => setQuery("")}>Clear</button>}</div><div className="header-actions"><div className="header-menu"><button className={`header-icon header-record-button ${openPanel === "favorites" ? "is-active" : ""}`} aria-label={`Saved items, ${favoriteProducts.length}`} aria-expanded={openPanel === "favorites"} onClick={() => setOpenPanel(openPanel === "favorites" ? null : "favorites")}><Heart size={18} fill={favoriteProducts.length ? "currentColor" : "none"} /><span>{favoriteProducts.length}</span></button>{openPanel === "favorites" && <div className="record-popover"><div className="record-popover-head"><strong>SAVED ITEMS</strong><div className="record-popover-actions">{favoriteProducts.length > 0 && <button className="record-clear-button" onClick={clearFavorites} aria-label="Clear all saved items">Clear all</button>}<button onClick={() => setOpenPanel(null)} aria-label="Close saved items"><X size={15} /></button></div></div>{favoriteProducts.length ? favoriteProducts.map((product) => <button className="record-row" key={product.id} onClick={() => openProduct(product.id)}><SafeProductImage sources={product.images} alt="" /><span><strong>{cleanTitle(product.catalogName || product.name)}</strong><small>{money(product.price, product.currency)}</small></span><ArrowUpRight size={14} /></button>) : <p className="record-empty">Your saved products will appear here.</p>}</div>}</div><div className="header-menu"><button className={`header-icon header-record-button ${openPanel === "history" ? "is-active" : ""}`} aria-label={`Browsing history, ${historyProducts.length}`} aria-expanded={openPanel === "history"} onClick={() => { setHistory(readHistory()); setOpenPanel(openPanel === "history" ? null : "history"); }}><HistoryIcon size={18} /><span>{historyProducts.length}</span></button>{openPanel === "history" && <div className="record-popover"><div className="record-popover-head"><strong>BROWSING HISTORY</strong><button onClick={() => setOpenPanel(null)} aria-label="Close browsing history"><X size={15} /></button></div>{historyProducts.length ? historyProducts.map(({ entry, product }) => <button className="record-row" key={product.id} onClick={() => openProduct(product.id)}><SafeProductImage sources={product.images} alt="" /><span><strong>{cleanTitle(product.catalogName || product.name)}</strong><small>Viewed {formatVisitTime(entry.visitedAt)}</small></span><ArrowUpRight size={14} /></button>) : <p className="record-empty">Products you open will appear here.</p>}</div>}</div><span className="live-status"><i /> <span className="demo-label">Demo</span> · Browsing {demoViewers} · Historical visits 20K+</span></div></header>
      
      <div className="catalog-toolbar">
        <div className="result-label">
          <span className="coral-dot" /> 
          {brand !== "all" ? englishValue(brand, "SELECTED BRAND") : category === "all" ? "ALL PRODUCTS" : englishCategoryLabels[category] || category.toUpperCase()}
        </div>
        <div className="flex items-center gap-4">
          {isAiAuditView && <button
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
          </button>}
          {seenIds.length > 0 && (
            <button onClick={resetAuditProgress} className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Reset Progress</button>
          )}
          {Object.keys(categoryErrorFlags).length > 0 && <span className="category-flag-count">Flagged {Object.keys(categoryErrorFlags).length}</span>}
          <label className="sort-select">Sort <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="random">{isAiAuditView ? "Random Audit" : "Random"}</option><option value="curated">Curated</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select><ChevronDown size={14} /></label>
        </div>
      </div>

      {visible.length > 0 ? <>
        <section className={isAiAuditView ? "grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2" : "masonry-grid"} aria-label="Product list">
          {visible.map((product, index) => { 
            const image = product.images[0]; 
            const isFav = favorites.includes(product.id); 
            const title = englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`); 
            const cardTitle = isSizeOnlyCardTitle(title) ? "" : title;
            const displayBrand = product.brand && product.brand.toLowerCase() !== "unbranded" ? englishValue(product.brand, "") : "";
            
            if (isAiAuditView) {
              return (
                <article key={product.id} className={`audit-card bg-white border border-black/5 p-1 flex flex-col gap-1 cursor-pointer hover:border-black/20 ${categoryErrorFlags[product.id] ? "is-category-flagged" : ""}`} onClick={() => openProduct(product.id)}>
                  <div className="aspect-square overflow-hidden bg-gray-50 relative">
                    <SafeProductImage sources={product.images} alt={title} className="w-full h-full object-cover" />
                    <button className={`category-flag-button ${categoryErrorFlags[product.id] ? "is-flagged" : ""}`} onClick={(event) => { event.stopPropagation(); toggleCategoryErrorFlag(product); }} aria-label={categoryErrorFlags[product.id] ? "Unmark category error" : "Mark category error"} title={categoryErrorFlags[product.id] ? "Unmark category error" : "Mark category error"}><Flag size={11} /></button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white px-1 truncate">
                      {product.sourceProductId}
                    </div>
                  </div>
                  {cardTitle && <div className="text-[9px] leading-tight truncate opacity-70">{cardTitle}</div>}
                </article>
              );
            }
            
            return <Fragment key={product.id}><article className={`product-card card-${index % 7} ${categoryErrorFlags[product.id] ? "is-category-flagged" : ""}`} onClick={() => openProduct(product.id)}><div className="product-image-wrap"><SafeProductImage sources={product.images} alt={title} loading={index < 8 ? "eager" : "lazy"} /><div className="image-wash" />{demoBadge(product.price) && <span className={`demo-product-badge ${demoBadge(product.price) === "NEW" ? "is-new" : "is-popular"}`}>{demoBadge(product.price)}</span>}{product.reviewStatus === "suspected" && <span className="suspected-review-badge" aria-label="Suspected category mismatch">SUSPECTED</span>}{isCuratedCategory(product) && <span className="curated-product-badge" aria-label="Curated selection">✦ CURATED</span>}<button className={`favorite-button ${isFav ? "is-favorite" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }} aria-label={isFav ? "Remove from saved items" : "Save product"}><Heart size={16} fill={isFav ? "currentColor" : "none"} /></button><button className={`category-flag-button ${categoryErrorFlags[product.id] ? "is-flagged" : ""}`} onClick={(event) => { event.stopPropagation(); toggleCategoryErrorFlag(product); }} aria-label={categoryErrorFlags[product.id] ? "Unmark category error" : "Mark category error"} title={categoryErrorFlags[product.id] ? "Unmark category error" : "Mark category error"}><Flag size={13} /></button><span className="view-stamp">VIEW FILE <ArrowUpRight size={10} /></span></div><div className="product-info">{displayBrand && <div className="product-brand">{displayBrand}</div>}{cardTitle && <h3 className="product-name">{cardTitle}</h3>}<div className="product-price">{money(product.price, "USD")} <span className="product-currency">USD</span></div></div></article></Fragment>; 
          })}
        </section>
        
        {!isAiAuditView && categoryRecommendationPool.length > 0 && <section className="category-recommendation" aria-labelledby="category-recommendation-title">
          <div id="category-recommendation" className="category-recommendation-head">
            <div>
              <span className="recommendation-kicker">CURATED DISCOVERY <i>/ 03</i></span>
              <h2 id="category-recommendation-title">Recommended products</h2>
              <p>Continue exploring a considered selection from this catalog.</p>
            </div>
            <span className="category-recommendation-aside">MORE TO EXPLORE</span>
          </div>
          <div className="category-recommendation-waterfall">
            {Array.from({ length: categoryRecommendationCount }, (_, index) => {
              const product = categoryRecommendationPool[index % categoryRecommendationPool.length];
              const title = englishValue(cleanTitle(product.catalogName || product.name), `Catalog Item ${product.id}`);
              const displayBrand = product.brand && product.brand.toLowerCase() !== "unbranded" ? englishValue(product.brand, "") : "";
              return <article key={`${product.id}-category-recommendation-${index}`} className={`category-recommendation-card recommendation-size-${index % 7}`} onClick={() => openProduct(product.id)}>
                <div className="category-recommendation-image"><SafeProductImage sources={product.images} alt={title} loading="lazy" /><span className="category-recommendation-open"><ArrowUpRight size={12} /></span></div>
                <div className="category-recommendation-meta">{displayBrand && <span className="category-recommendation-brand">{displayBrand}</span>}<strong>{title}</strong><span>{money(product.price, "USD")}</span></div>
              </article>;
            })}
          </div>
          <div ref={categoryRecommendationSentinel} className="category-recommendation-sentinel" aria-hidden="true" />
        </section>}

        {isAiAuditView && <div className="audit-controls py-20 flex flex-col items-center justify-center border-t border-black/5 mt-20">
          <div className="text-center mb-8">
            <h4 className="text-2xl font-light tracking-tight mb-2">Batch Review Complete</h4>
            <p className="text-sm opacity-50">Mark this batch complete to automatically load the next unreviewed batch.</p>
          </div>
          <button 
            onClick={markPageAsSeen}
            className="group relative flex items-center gap-3 px-10 py-5 bg-black text-white rounded-full hover:scale-105 transition-transform active:scale-95"
          >
            <CheckCircle2 size={20} className="text-emerald-400" />
            <span className="text-sm font-medium tracking-widest uppercase">Mark as Reviewed & Next Batch</span>
            <RefreshCw size={16} className="opacity-50 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>}
      </> : <div className="empty-state">
        <div className="empty-icon">✦</div>
        <h3>No products found</h3>
        <p>All products in this category have been reviewed or match no results.</p>
        <button onClick={resetFilters}>Clear all filters</button>
      </div>}
    </main>
    {settingsOpen && <div className="settings-overlay" onClick={() => setSettingsOpen(false)}><div className="settings-modal" onClick={(e) => e.stopPropagation()}><div className="settings-head"><strong>DISPLAY SETTINGS</strong><button onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div><div className="settings-body"><div className="settings-section"><label>PAGE STYLE</label><div className="style-grid">{["default", "white", "gray", "black", "green"].map((s) => <button key={s} className={`style-opt is-${s} ${pageStyle === s ? "is-active" : ""}`} onClick={() => setPageStyle(s)} aria-label={`Switch to ${s} style`} />)}</div></div><div className="settings-section"><label>FONT SIZE</label><input type="range" min="0" max="2" step="1" value={fontSizeLevel} onChange={(e) => setFontSizeLevel(Number(e.target.value))} /></div><div className="settings-section"><label>LETTER SPACING</label><input type="range" min="0" max="2" step="1" value={letterSpacingLevel} onChange={(e) => setLetterSpacingLevel(Number(e.target.value))} /></div></div></div></div>}
    <RequestProductDialog open={requestProductOpen} onClose={() => setRequestProductOpen(false)} />
  </div>;
}
