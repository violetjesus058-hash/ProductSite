import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, ExternalLink, LayoutGrid, Moon, Share2, Store, Sun, Table2, X } from "lucide-react";
import "./spreadsheet.css";
import CatalogEntryChooser from "@/components/CatalogEntryChooser";
import { initializeAnalytics, trackEvent, trackOnce } from "@/lib/analytics";
import { filterCatalogItems, paginateCatalogItems, type CatalogSummary, type CatalogSort } from "@/lib/catalogSummary";
import { isLongSleeve, LONG_SLEEVE_CATEGORY } from "@/lib/catalogOrdering.mjs";
import { normalizePlatformName, platformIconFor, platformSourcesFor, type PlatformSource } from "@/lib/platformSources.mjs";
import { mergeCatalogOverrides, mergePreviewOverrides, type CatalogPreviewGroup, type CatalogProductOverride } from "@/lib/catalogOverrides";
import { displayStyleLabel } from "@/data/style-label-map";

type CatalogMeta = {
  total: number;
  generatedAt: string;
  pageSizes: number[];
  categories: Array<{ key: string; label: string }>;
  quickCategories?: Array<{ key: string; label: string; thumbnail: string }>;
  platforms: Array<{ key: string; label: string }>;
};
type CatalogPageRow = Omit<CatalogSummary, "platformKeys"> & { platformKeys?: string[] };
type PagePayload = { page: number; pageSize: number; total: number; totalPages: number; items: CatalogPageRow[] };
type ViewState = { category: string; platform: string; sort: CatalogSort; page: number };
type QuickCategoryIntent = { category: string; token: number };
type MenuPermissionNotice = { title: string; message: string; dismissLabel: string; left: number; top: number; width: number };
type PreviewStyle = { id: string; styleKey: string; styleLabel: string; image: string; price: number; currency: string };
type ProductPreviewGroup = CatalogPreviewGroup;
type ImagePreviewItem = Pick<CatalogPageRow, "name" | "styleLabel" | "thumbnail">;
type InlinePurchaseCardProps = {
  item: CatalogPageRow;
  group?: ProductPreviewGroup;
  selectedPlatform: string;
  selectedStyleId: string | null;
  showAllPlatforms: boolean;
  loading: boolean;
  error: string;
  onStyleSelect: (id: string) => void;
  onTogglePlatforms: () => void;
  onImageOpen: (item: ImagePreviewItem) => void;
  onPlatformClick: (platform: PlatformSource, group: ProductPreviewGroup, style: PreviewStyle) => void;
  onRetry: () => void;
};

function PlatformPicker({ platforms, value, onChange }: { platforms: Array<{ key: string; label: string }>; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = platforms.find((item) => item.key === value);
  const selectedIcon = selected ? platformIconFor(selected.label) : "";
  const choose = (nextValue: string) => { onChange(nextValue); setOpen(false); };
  return <div className={`spreadsheet-platform-picker ${open ? "is-open" : ""}`}>
    <button type="button" className="spreadsheet-platform-picker-trigger" aria-label="Platform" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {selectedIcon ? <img src={selectedIcon} alt="" aria-hidden="true" /> : <Store className="spreadsheet-control-icon" size={21} strokeWidth={1.9} aria-hidden="true" />}
      <span className="spreadsheet-select-label"><span>Platform</span>{!value && <b>CHOOSE</b>}</span>
      <span className="spreadsheet-select-value">{selected?.label || "All platforms"}</span>
      <ChevronDown className="spreadsheet-select-chevron" size={16} aria-hidden="true" />
    </button>
    {open && <div className="spreadsheet-platform-picker-menu" role="listbox" aria-label="Choose platform">
      <button type="button" role="option" aria-selected={!value} className={!value ? "is-selected" : ""} onClick={() => choose("")}><Store size={18} aria-hidden="true" /><span>All platforms</span></button>
      {platforms.map((item) => {
        const icon = platformIconFor(item.label);
        return <button key={item.key} type="button" role="option" aria-selected={item.key === value} className={item.key === value ? "is-selected" : ""} onClick={() => choose(item.key)}>
          {icon ? <img src={icon} alt="" aria-hidden="true" /> : <span className="spreadsheet-platform-picker-fallback" aria-hidden="true">{item.label.charAt(0)}</span>}
          <span>{item.label}</span>
        </button>;
      })}
    </div>}
  </div>;
}

function InlinePurchaseCard({ item, group, selectedPlatform, selectedStyleId, showAllPlatforms, loading, error, onStyleSelect, onTogglePlatforms, onImageOpen, onPlatformClick, onRetry }: InlinePurchaseCardProps) {
  if (!group) return <div className="spreadsheet-inline-state" role={error ? "alert" : "status"}>
    {loading ? <><span className="spreadsheet-loader" /> Loading purchase options…</> : <><span>{error || "Purchase options are unavailable."}</span><button type="button" onClick={onRetry}>Retry</button></>}
  </div>;

  const selectedStyle = group.styles.find((style) => style.id === selectedStyleId) || group.styles.find((style) => style.id === item.id) || group.styles[0];
  if (!selectedStyle) return <div className="spreadsheet-inline-state" role="status">No style options available.</div>;
  const selectedPlatformSource = selectedPlatform
    ? group.platforms.find((platform) => normalizePlatformName(platform.name) === normalizePlatformName(selectedPlatform))
    : undefined;
  // /spreadsheet1 放开 Kakobuy，主平台仍按数据里的 primary 取（Kakobuy 不带 primary 标记）
  const primary = selectedPlatformSource || group.platforms.find((platform) => platform.primary) || group.platforms[0];
  const orderedPlatforms = primary ? [primary, ...group.platforms.filter((platform) => platform !== primary)] : group.platforms;
  const visiblePlatforms = showAllPlatforms ? orderedPlatforms : orderedPlatforms.slice(0, 5);
  const styleImageUrl = selectedStyle.image || item.thumbnail || placeholder;
  const refreshedStyleImageUrl = `${styleImageUrl}${styleImageUrl.includes("?") ? "&" : "?"}style=${encodeURIComponent(selectedStyle.id)}`;

  return <section className="spreadsheet-inline-purchase" aria-label={`Quick purchase options for ${group.name}`}>
    <div className="spreadsheet-inline-visual">
      <button className="spreadsheet-inline-main-image" type="button" onClick={() => onImageOpen({ name: group.name, styleLabel: selectedStyle.styleLabel, thumbnail: styleImageUrl })} aria-label={`View original image: ${group.name}${selectedStyle.styleLabel ? `, Style ${displayStyleLabel(selectedStyle.styleLabel)}` : ""}`}>
        <img key={`${group.sourceProductId}-${selectedStyle.id}-${styleImageUrl}`} src={refreshedStyleImageUrl} alt={`${group.name}${selectedStyle.styleLabel ? `, Style ${displayStyleLabel(selectedStyle.styleLabel)}` : ""}`} loading="lazy" decoding="async" />
        <span>Click image to enlarge</span>
      </button>
      <div className="spreadsheet-inline-style-picker">
        <div className="spreadsheet-inline-style-heading"><span>STYLE</span><small>{group.styles.length} options</small></div>
        <div className="spreadsheet-inline-style-list" role="group" aria-label="Choose a style">
          {group.styles.map((style, index) => {
            const selected = style.id === selectedStyle.id;
            const translatedLabel = displayStyleLabel(style.styleLabel);
            const label = translatedLabel ? `Style ${translatedLabel}` : `Style ${index + 1}`;
            return <button key={style.id} type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} onClick={() => onStyleSelect(style.id)}>{label}</button>;
          })}
        </div>
      </div>
    </div>
    <div className="spreadsheet-inline-commerce">
      <div className="spreadsheet-inline-product-heading"><div><span>SELECTED STYLE</span><strong>{group.name}</strong><small>{displayStyleLabel(selectedStyle.styleLabel) ? `Style ${displayStyleLabel(selectedStyle.styleLabel)}` : "Style not specified"}</small></div><b>{formatMoney(selectedStyle.price, selectedStyle.currency)}</b></div>
      <div className="spreadsheet-inline-platform-heading"><span>BUYING PLATFORMS</span><small>{group.platforms.length} sources</small></div>
      <div className="spreadsheet-inline-platform-list">
        {visiblePlatforms.map((platform) => {
          const icon = platformIconFor(platform.name);
          return <a key={platform.name} href={platform.url} target="_blank" rel="noopener noreferrer" className={`spreadsheet-inline-platform ${platform === primary ? "is-primary" : ""}`} onClick={() => onPlatformClick(platform, group, selectedStyle)}>
            <span className="spreadsheet-inline-platform-identity">{icon ? <img src={icon} alt="" aria-hidden="true" loading="lazy" /> : <i aria-hidden="true">{platform.name.charAt(0).toUpperCase()}</i>}<strong>{platform.name}</strong></span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>;
        })}
      </div>
      {orderedPlatforms.length > 5 && <button type="button" className="spreadsheet-inline-more" aria-expanded={showAllPlatforms} onClick={onTogglePlatforms}>{showAllPlatforms ? "Show fewer platforms" : `Show ${orderedPlatforms.length - 5} more platforms`}<ChevronDown size={14} className={showAllPlatforms ? "is-expanded" : ""} /></button>}
    </div>
  </section>;
}

const basePath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-data-1`;
const placeholder = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-detail-stilllife.webp`;
const entryPreviewBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/entry-previews`;
const THEME_STORAGE_KEY = "rivora-spreadsheet-theme-v1";
const QUICK_CATEGORY_COOLDOWN_MS = 450;
const QUICK_CATEGORY_SETTLE_MS = 450;
const quickCategoryOptions = [
  { key: "shoe", label: "Shoes" },
  { key: LONG_SLEEVE_CATEGORY, label: "Long sleeve" },
  { key: "pants", label: "Pants" },
  { key: "clothing", label: "Clothing" },
  { key: "ACC", label: "Accessories" },
  { key: "bags", label: "Bags" },
  { key: "watches", label: "Watches" },
];
let catalogIndexPromise: Promise<CatalogSummary[]> | null = null;
const previewGroupPromises = new Map<string, Promise<ProductPreviewGroup>>();

function readLocalPreference(key: string) {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); }
  catch { return null; }
}

function saveLocalPreference(key: string, value: string) {
  try { if (typeof window !== "undefined") window.localStorage.setItem(key, value); }
  catch { /* Continue if browser storage is unavailable. */ }
}

function menuPermissionCopy(menuName: string) {
  return { title: "No permission", message: `You don't have permission to use the “${menuName}” menu in this catalog.`, dismissLabel: "Dismiss permission notice" };
}

function readViewState(): ViewState {
  const params = new URLSearchParams(window.location.search);
  const sortValue = params.get("sort");
  const allowedSorts: CatalogSort[] = ["random", "price-low", "price-high", "name", "recent"];
  const parsedPage = Number(params.get("page") || "1");
  const requestedPlatform = normalizePlatformName(params.get("platform") || "");
  return {
    category: params.get("category") || "",
    platform: requestedPlatform === "all" || requestedPlatform === "allplatforms" ? "" : requestedPlatform,
    sort: allowedSorts.includes(sortValue as CatalogSort) ? sortValue as CatalogSort : "random",
    page: Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1,
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function loadCatalogIndex(): Promise<CatalogSummary[]> {
  if (!catalogIndexPromise) {
    catalogIndexPromise = fetchJson<CatalogSummary[]>(`${basePath}/catalog-index.json`).catch((error) => {
      catalogIndexPromise = null;
      throw error;
    });
  }
  return catalogIndexPromise;
}

function loadPreviewGroup(sourceProductId: string): Promise<ProductPreviewGroup> {
  const cached = previewGroupPromises.get(sourceProductId);
  if (cached) return cached;
  // 该数据集由 CSV 索引直接构造，不再读取旧的 previews/*.json 文件
  const request = loadCatalogIndex().then((items) => {
    const rows = items.filter((item) => item.sourceProductId === sourceProductId);
    if (!rows.length) throw new Error("Product not found in catalog.");
    const first = rows[0];
    const platforms = platformSourcesFor({ id: first.id, sourceProductId })
      .map((source: PlatformSource) => ({ name: source.name, url: source.url, primary: !!source.primary }));
    return {
      sourceProductId,
      name: first.name,
      platforms,
      styles: rows.map((row) => ({
        id: row.id,
        styleKey: row.styleKey,
        styleLabel: row.styleLabel,
        image: row.thumbnail,
        price: row.price,
        currency: row.currency,
      })),
    };
  }).catch((error) => {
    previewGroupPromises.delete(sourceProductId);
    throw error;
  });
  previewGroupPromises.set(sourceProductId, request);
  return request;
}

function formatMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function ImageThumb({ item }: { item: CatalogPageRow }) {
  const [failed, setFailed] = useState(false);
  return <img
    className="spreadsheet-thumb"
    src={failed ? placeholder : item.thumbnail || placeholder}
    alt={`${item.name}${item.styleLabel ? `, Style ${displayStyleLabel(item.styleLabel)}` : ""}`}
    loading="lazy"
    decoding="async"
    onError={() => setFailed(true)}
  />;
}

export default function SpreadsheetCatalog1() {
  const [, setLocation] = useLocation();
  useEffect(() => { document.documentElement.lang = "en"; }, []);
  const [view, setView] = useState<ViewState>(readViewState);
  const [shuffleSeed] = useState(() => {
    const seed = new Uint32Array(1);
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(seed);
      return seed[0];
    }
    return Math.floor(Math.random() * 0x1_0000_0000);
  });
  const [catalogTheme, setCatalogTheme] = useState<"light" | "dark">(() => readLocalPreference(THEME_STORAGE_KEY) === "dark" ? "dark" : "light");
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuNotice, setMenuNotice] = useState<MenuPermissionNotice | null>(null);
  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [productOverrides, setProductOverrides] = useState<CatalogProductOverride[]>([]);
  const [overridesReady, setOverridesReady] = useState(false);
  const [runtimeCatalogIndex, setRuntimeCatalogIndex] = useState<CatalogSummary[] | null>(null);
  const [runtimeCatalogReady, setRuntimeCatalogReady] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [payload, setPayload] = useState<PagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imagePreviewItem, setImagePreviewItem] = useState<ImagePreviewItem | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [previewGroups, setPreviewGroups] = useState<Record<string, ProductPreviewGroup>>({});
  const [previewLoadingSourceId, setPreviewLoadingSourceId] = useState<string | null>(null);
  const [previewErrorSourceId, setPreviewErrorSourceId] = useState<string | null>(null);
  const [quickCategoryBusy, setQuickCategoryBusy] = useState(false);
  const [pendingQuickCategory, setPendingQuickCategory] = useState<string | null>(null);
  const previewRequestRef = useRef(0);
  const requestNumber = useRef(0);
  const quickCategoryBusyRef = useRef(false);
  const quickCategoryIntentRef = useRef<QuickCategoryIntent | null>(null);
  const quickCategorySequenceRef = useRef(0);
  const quickCategoryLastAcceptedAtRef = useRef(0);
  const quickCategoryReleaseTimerRef = useRef<number | null>(null);
  const menuNoticeTimerRef = useRef<number | null>(null);
  const directoryLayoutRef = useRef<HTMLDivElement | null>(null);
  const pendingPaginationScrollRef = useRef(false);

  useEffect(() => { saveLocalPreference(THEME_STORAGE_KEY, catalogTheme); }, [catalogTheme]);
  useEffect(() => () => { if (menuNoticeTimerRef.current !== null) window.clearTimeout(menuNoticeTimerRef.current); }, []);

  function showMenuPermissionNotice(menuName: string, trigger: HTMLButtonElement) {
    const copy = menuPermissionCopy(menuName);
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const estimatedHeight = 82;
    const preferredTop = rect.bottom + 8;
    const top = preferredTop + estimatedHeight > window.innerHeight - 8 ? Math.max(8, rect.top - estimatedHeight - 8) : preferredTop;
    setMenuNotice({ ...copy, left, top, width });
    if (menuNoticeTimerRef.current !== null) window.clearTimeout(menuNoticeTimerRef.current);
    menuNoticeTimerRef.current = window.setTimeout(() => {
      setMenuNotice(null);
      menuNoticeTimerRef.current = null;
    }, 4500);
  }

  useEffect(() => {
    initializeAnalytics();
    trackOnce("table_page_view", "spreadsheet", { page_type: "table_catalog" });
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setPageSize(media.matches ? 20 : 50);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const onPopState = () => setView(readViewState());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    params.set("view", "styles");
    for (const key of ["q", "category", "platform", "sort", "page"]) params.delete(key);
    if (view.category) params.set("category", view.category);
    if (view.platform) params.set("platform", view.platform);
    if (view.sort !== "random") params.set("sort", view.sort);
    if (view.page > 1) params.set("page", String(view.page));
    window.history.replaceState(window.history.state, "", `${url.pathname}?${params.toString()}`);
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<CatalogMeta>(`${basePath}/meta.json`, controller.signal)
      .then((value) => setMeta(value))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Catalog data is temporarily unavailable.");
        setLoading(false);
      });
    setProductOverrides([]);
    setOverridesReady(true);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!meta || !overridesReady) return;
    if (!productOverrides.length) {
      setRuntimeCatalogIndex(null);
      setRuntimeCatalogReady(true);
      return;
    }
    let active = true;
    setRuntimeCatalogReady(false);
    void loadCatalogIndex()
      .then((rows) => { if (active) setRuntimeCatalogIndex(mergeCatalogOverrides(rows, productOverrides)); })
      .catch((reason: unknown) => {
        if (active) {
          console.warn("Live product updates could not be applied to the spreadsheet catalog.", reason);
          setRuntimeCatalogIndex(null);
        }
      })
      .finally(() => { if (active) setRuntimeCatalogReady(true); });
    return () => { active = false; };
  }, [meta, overridesReady, productOverrides]);

  const catalogMeta = useMemo<CatalogMeta | null>(() => {
    if (!meta || !runtimeCatalogIndex) return meta;
    const labels = new Map(meta.categories.map((category) => [category.key, category.label]));
    const knownLabels: Record<string, string> = { clothing: "Clothing", shoe: "Shoes", pants: "Pants", bags: "Bags", fragrance: "Fragrance", watches: "Watches", ACC: "Accessories" };
    const categories = [...new Set(runtimeCatalogIndex.map((item) => item.category).filter(Boolean))].map((key) => ({ key, label: labels.get(key) || knownLabels[key] || key }));
    const platformNames = [...new Set(runtimeCatalogIndex.flatMap((item) => item.platformKeys || []))].sort((a, b) => a.localeCompare(b));
    const quickCategories = quickCategoryOptions.map((definition) => {
      const match = runtimeCatalogIndex.find((item) => definition.key === LONG_SLEEVE_CATEGORY
        ? isLongSleeve(item)
        : item.category === definition.key);
      return { key: definition.key, label: definition.label, thumbnail: match?.thumbnail || meta.quickCategories?.find((item) => item.key === definition.key)?.thumbnail || placeholder };
    });
    return {
      ...meta,
      total: runtimeCatalogIndex.length,
      categories,
      quickCategories,
      platforms: platformNames.map((key) => ({ key, label: key })),
    };
  }, [meta, runtimeCatalogIndex]);

  useEffect(() => {
    if (!catalogMeta || !view.platform) return;
    const requestedPlatform = normalizePlatformName(view.platform);
    const matchedPlatform = catalogMeta.platforms.find((platform) =>
      normalizePlatformName(platform.key) === requestedPlatform || normalizePlatformName(platform.label) === requestedPlatform,
    );
    if (matchedPlatform) {
      if (view.platform !== matchedPlatform.key) setView((current) => current.platform === view.platform ? { ...current, platform: matchedPlatform.key } : current);
      return;
    }
    setView((current) => current.platform === view.platform ? { ...current, platform: "", page: 1 } : current);
  }, [catalogMeta, view.platform]);

  useEffect(() => {
    if (!catalogMeta || !overridesReady || !runtimeCatalogReady) return;
    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    const quickIntentForRequest = quickCategoryIntentRef.current;
    const isQuickCategoryRequest = !!quickIntentForRequest && quickIntentForRequest.category === view.category;
    setLoading(true);
    setError("");
    const load = async () => {
      try {
        const index = runtimeCatalogIndex || await loadCatalogIndex();
        if (controller.signal.aborted || requestNumber.current !== currentRequest) return;
        const filtered = filterCatalogItems(index, { category: view.category, platform: view.platform, sort: view.sort, seed: shuffleSeed });
        const result = paginateCatalogItems(filtered, view.page, pageSize);
        if (result.page !== view.page) setView((old) => ({ ...old, page: result.page }));
        if (requestNumber.current === currentRequest) setPayload({ ...result, totalPages: result.totalPages });
      } catch (reason) {
        if (controller.signal.aborted || requestNumber.current !== currentRequest) return;
        setError(reason instanceof Error ? reason.message : "Catalog data is temporarily unavailable.");
      } finally {
        if (!controller.signal.aborted && requestNumber.current === currentRequest) {
          setLoading(false);
          if (isQuickCategoryRequest && quickCategoryIntentRef.current === quickIntentForRequest) {
            quickCategoryReleaseTimerRef.current = window.setTimeout(() => {
              if (quickCategoryIntentRef.current !== quickIntentForRequest || requestNumber.current !== currentRequest) return;
              quickCategoryIntentRef.current = null;
              quickCategoryBusyRef.current = false;
              quickCategoryReleaseTimerRef.current = null;
              setQuickCategoryBusy(false);
              setPendingQuickCategory(null);
            }, QUICK_CATEGORY_SETTLE_MS);
          }
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [catalogMeta, overridesReady, runtimeCatalogReady, runtimeCatalogIndex, pageSize, view.page, view.category, view.platform, view.sort, shuffleSeed]);

  useEffect(() => {
    if (!imagePreviewItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImagePreviewItem(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imagePreviewItem]);

  const categories = catalogMeta?.categories || [];
  const quickCategories = quickCategoryOptions.map((item) => ({
    ...item,
    thumbnail: catalogMeta?.quickCategories?.find((category) => category.key === item.key)?.thumbnail || placeholder,
  }));
  const categoryOptions = [...categories, { key: LONG_SLEEVE_CATEGORY, label: "Long sleeve" }];
  const selectedCategoryLabel = view.category === LONG_SLEEVE_CATEGORY ? "Long sleeve" : categories.find((item) => item.key === view.category)?.label || "All categories";
  const platforms = catalogMeta?.platforms || [];
  const selectedPlatformLabel = platforms.find((item) => item.key === view.platform)?.label;
  const rows = payload?.items || [];
  function primaryPlatformLabelFor(item: CatalogPageRow) {
    const selectedPlatformKey = normalizePlatformName(view.platform);
    const hasSelectedPlatform = selectedPlatformKey && item.platformKeys?.some((key) => normalizePlatformName(key) === selectedPlatformKey);
    return hasSelectedPlatform ? selectedPlatformLabel || item.primaryPlatform || "Platforms" : item.primaryPlatform || "Platforms";
  }
  const countLabel = useMemo(() => {
    if (!payload) return "";
    const start = payload.total === 0 ? 0 : (payload.page - 1) * pageSize + 1;
    const end = Math.min(payload.page * pageSize, payload.total);
    return `${start.toLocaleString()}–${end.toLocaleString()} of ${payload.total.toLocaleString()}`;
  }, [payload, pageSize]);

  function updateView(patch: Partial<ViewState>) {
    setView((old) => ({ ...old, ...patch }));
  }

  function cancelQuickCategoryIntent() {
    quickCategoryIntentRef.current = null;
    quickCategoryBusyRef.current = false;
    quickCategoryLastAcceptedAtRef.current = 0;
    if (quickCategoryReleaseTimerRef.current !== null) window.clearTimeout(quickCategoryReleaseTimerRef.current);
    quickCategoryReleaseTimerRef.current = null;
    setQuickCategoryBusy(false);
    setPendingQuickCategory(null);
  }

  function clearFilters() {
    cancelQuickCategoryIntent();
    setView((old) => ({ ...old, category: "", platform: "", sort: "random", page: 1 }));
  }

  function setCategory(category: string) {
    cancelQuickCategoryIntent();
    updateView({ category, page: 1 });
    if (category) trackEvent("table_filter_use", { category, page_type: "table_catalog" });
  }

  function setQuickCategory(category: string, triggerKey: string) {
    const now = Date.now();
    if (loading || quickCategoryBusyRef.current || now - quickCategoryLastAcceptedAtRef.current < QUICK_CATEGORY_COOLDOWN_MS) return;
    quickCategoryLastAcceptedAtRef.current = now;
    const intent = { category, token: ++quickCategorySequenceRef.current };
    quickCategoryIntentRef.current = intent;
    quickCategoryBusyRef.current = true;
    setQuickCategoryBusy(true);
    setPendingQuickCategory(triggerKey);
    updateView({ category, page: 1 });
    if (category) trackEvent("table_filter_use", { category, page_type: "table_catalog" });
  }

  function setPlatform(platform: string) {
    cancelQuickCategoryIntent();
    updateView({ platform, page: 1 });
    if (platform) {
      trackEvent("table_filter_use", { platform, page_type: "table_catalog", filter_type: "platform", previous_platform: view.platform || "all", page_number: view.page, sort: view.sort });
      trackEvent("spreadsheet_platform_select", { page_type: "spreadsheet", platform, previous_platform: view.platform || "all", page_number: view.page, category: view.category || "all", sort: view.sort, selection_mode: "explicit_filter" });
    }
  }

  function setSort(sort: CatalogSort) {
    cancelQuickCategoryIntent();
    updateView({ sort, page: 1 });
    trackEvent("table_sort_use", { sort, page_type: "table_catalog" });
  }

  function setPage(page: number) {
    cancelQuickCategoryIntent();
    pendingPaginationScrollRef.current = true;
    updateView({ page });
    trackEvent("table_pagination_change", { page_number: page, page_type: "table_catalog" });
  }

  function requestPreviewGroup(item: CatalogPageRow) {
    const currentRequest = ++previewRequestRef.current;
    setPreviewLoadingSourceId(item.sourceProductId);
    setPreviewErrorSourceId(null);
    const matchingOverrides = productOverrides.filter((override) => String(override.sourceProductId || override.id || "") === item.sourceProductId);
    void loadPreviewGroup(item.sourceProductId).catch(() => null).then((baseGroup) => {
      const group = mergePreviewOverrides(baseGroup, item.sourceProductId, matchingOverrides);
      if (!group) throw new Error("Purchase preview is unavailable.");
      setPreviewGroups((current) => ({ ...current, [item.sourceProductId]: group }));
      const automaticallySelected = view.platform
        ? group.platforms.find((platform) => normalizePlatformName(platform.name) === normalizePlatformName(view.platform))
        : group.platforms.find((platform) => platform.primary) || group.platforms[0];
      if (automaticallySelected) trackOnce("spreadsheet_platform_auto_select", `${item.id}:${view.platform || "default"}`, {
        page_type: "spreadsheet",
        product_id: item.id,
        source_product_id: item.sourceProductId,
        platform: automaticallySelected.name,
        selection_mode: view.platform ? "filter_selected" : "default_primary",
        page_number: view.page,
        category: item.category,
        platform_count: group.platforms.length,
      });
      if (previewRequestRef.current === currentRequest) setPreviewLoadingSourceId(null);
    }).catch(() => {
      if (previewRequestRef.current === currentRequest) {
        setPreviewLoadingSourceId(null);
        setPreviewErrorSourceId(item.sourceProductId);
      }
    });
  }

  function toggleInlinePreview(item: CatalogPageRow) {
    previewRequestRef.current += 1;
    setPreviewLoadingSourceId(null);
    setPreviewErrorSourceId(null);
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      setSelectedStyleId(null);
      setShowAllPlatforms(false);
      return;
    }
    setExpandedItemId(item.id);
    setSelectedStyleId(item.id);
    setShowAllPlatforms(false);
    if (!previewGroups[item.sourceProductId]) requestPreviewGroup(item);
  }

  useEffect(() => {
    setExpandedItemId(null);
    setSelectedStyleId(null);
    setShowAllPlatforms(false);
    setPreviewLoadingSourceId(null);
  }, [view.category, view.platform, view.sort, view.page]);

  useEffect(() => {
    if (!pendingPaginationScrollRef.current || loading || !payload || payload.page !== view.page) return;
    pendingPaginationScrollRef.current = false;
    window.requestAnimationFrame(() => {
      const target = directoryLayoutRef.current;
      if (!target) return;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 16);
      window.scrollTo({ top, behavior: "auto" });
    });
  }, [loading, payload, view.page]);

  function trackInlinePlatformClick(platform: PlatformSource, item: CatalogPageRow, style: PreviewStyle) {
    trackEvent("affiliate_click", { page_type: "spreadsheet", surface: "spreadsheet_inline", product_id: style.id, source_product_id: item.sourceProductId, product_name: item.name.slice(0, 120), style_label: style.styleLabel || null, product_image: style.image || item.thumbnail || null, category: item.category, price: style.price, currency: style.currency, platform: platform.name, destination: platform.name, location: "table_inline_purchase", selection_mode: view.platform ? "filtered_platform" : platform.primary ? "default_primary" : "fallback_first", page_number: view.page });
  }

  function renderInlinePurchaseCard(item: CatalogPageRow) {
    return <InlinePurchaseCard
      item={item}
      group={previewGroups[item.sourceProductId]}
      selectedPlatform={view.platform}
      selectedStyleId={selectedStyleId}
      showAllPlatforms={showAllPlatforms}
      loading={previewLoadingSourceId === item.sourceProductId}
      error={previewErrorSourceId === item.sourceProductId ? "Could not load this product’s purchase options." : ""}
      onStyleSelect={setSelectedStyleId}
      onTogglePlatforms={() => setShowAllPlatforms((visible) => !visible)}
      onImageOpen={setImagePreviewItem}
      onPlatformClick={(platform, _group, style) => trackInlinePlatformClick(platform, item, style)}
      onRetry={() => requestPreviewGroup(item)}
    />;
  }

  function rowDisplayItem(item: CatalogPageRow, expanded: boolean): CatalogPageRow {
    if (!expanded) return item;
    const selectedStyle = previewGroups[item.sourceProductId]?.styles.find((style) => style.id === selectedStyleId);
    if (!selectedStyle) return item;
    return { ...item, thumbnail: selectedStyle.image || item.thumbnail, styleLabel: selectedStyle.styleLabel, price: selectedStyle.price, currency: selectedStyle.currency };
  }

  useEffect(() => {
    if (!loading && payload?.total === 0) trackEvent("table_empty_result", { category: view.category, platform: view.platform, page_type: "table_catalog" });
  }, [loading, payload?.total, view.category, view.platform]);

  const pageCount = payload?.totalPages || (catalogMeta ? Math.max(1, Math.ceil(catalogMeta.total / pageSize)) : 1);
  const shareUrl = window.location.href;
  const shareTitle = "RIVORA Style Directory";
  const shareText = "Browse styles, prices, and buying platforms in the RIVORA catalog.";
  const shareLinks = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { name: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { name: "Email", href: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}` },
  ];
  async function copyCatalogLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      window.prompt("Copy catalog link", shareUrl);
    }
  }
  async function shareCatalog() {
    try { await navigator.share?.({ title: shareTitle, text: shareText, url: shareUrl }); }
    catch { /* Dismissal is normal; keep the page in place. */ }
    setShareOpen(false);
  }
  const previewUrl = imagePreviewItem?.thumbnail || placeholder;
  const previewAlt = imagePreviewItem ? `${imagePreviewItem.name}${imagePreviewItem.styleLabel ? `, Style ${displayStyleLabel(imagePreviewItem.styleLabel)}` : ""}` : "";

  return <main className="spreadsheet-shell" data-theme={catalogTheme}>
    <header className="spreadsheet-header">
      <Link href="/" className="spreadsheet-brand" aria-label="RIVORA product catalog"><img src="/branding/rivora-icon.png" alt="" /><span>RIVORA</span></Link>
      <div className="spreadsheet-document-name"><strong>RIVORA Product Catalog</strong><small>Interactive catalog</small></div>
      <div className="browse-mode-switch spreadsheet-browse-mode-switch" aria-label="Switch browsing mode"><a href="/" onClick={() => trackEvent("browse_mode_switch", { from_mode: "spreadsheet", to_mode: "product-site", source: "header" })}>Gallery</a><span className="is-active">Spreadsheet</span></div>
      <nav aria-label="Main navigation"><a href="https://productsite-8wf.pages.dev/">Product Catalog</a><a href="https://productsite-8wf.pages.dev/spreadsheet1" aria-current="page">Catalog Table</a></nav>
      <a href="https://productsite-8wf.pages.dev/" className="spreadsheet-back"><ArrowLeft size={15} /> Product Catalog</a>
      <div className="spreadsheet-share-control share-control">
        <button className="spreadsheet-share-button detail-share-button" type="button" onClick={() => setShareOpen((open) => !open)} aria-label="Share this catalog" aria-haspopup="menu" aria-expanded={shareOpen} aria-controls="spreadsheet-share-menu" title="Share this catalog"><Share2 size={16} aria-hidden="true" /><span>Share</span></button>
        {shareOpen && <div className="spreadsheet-share-menu share-menu" id="spreadsheet-share-menu" role="menu" aria-label="Share this catalog"><div className="share-menu-title">SHARE THIS CATALOG</div><button className="share-copy" type="button" role="menuitem" onClick={() => { void copyCatalogLink(); }}><span>{linkCopied ? "Link copied" : "Copy catalog link"}</span>{linkCopied ? <Check size={14} /> : <Copy size={14} />}</button>{shareLinks.map((item) => <a key={item.name} href={item.href} target={item.name === "Email" ? undefined : "_blank"} rel={item.name === "Email" ? undefined : "noopener noreferrer"} role="menuitem" onClick={() => setShareOpen(false)}>{item.name}<ExternalLink size={13} aria-hidden="true" /></a>)}{typeof navigator !== "undefined" && "share" in navigator && <button className="share-native" type="button" role="menuitem" onClick={() => { void shareCatalog(); }}>More sharing options<Share2 size={13} aria-hidden="true" /></button>}</div>}
      </div>
      <button className="spreadsheet-theme-toggle" type="button" onClick={() => setCatalogTheme((current) => current === "light" ? "dark" : "light")} aria-label={`Switch to ${catalogTheme === "light" ? "dark" : "light"} theme`} aria-pressed={catalogTheme === "dark"} title={`Switch to ${catalogTheme === "light" ? "dark" : "light"} theme`}>
        {catalogTheme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        <span>{catalogTheme === "light" ? "Dark" : "Light"}</span>
      </button>
    </header>

    <div className="spreadsheet-sheet-menu" role="toolbar" aria-label="Spreadsheet menu bar">{["File", "Edit", "View", "Insert", "Format", "Data", "Tools", "Extensions", "Help"].map((menu) => { const copy = menuPermissionCopy(menu); return <button key={menu} type="button" aria-disabled="true" title={`${copy.title}: ${copy.message}`} onClick={(event) => showMenuPermissionNotice(menu, event.currentTarget)}>{menu}</button>; })}</div>
    {menuNotice && <div className="spreadsheet-permission-popover" role="status" aria-live="polite" style={{ left: menuNotice.left, top: menuNotice.top, width: menuNotice.width }}><strong>{menuNotice.title}</strong><span>{menuNotice.message}</span><button type="button" aria-label={menuNotice.dismissLabel} onClick={() => setMenuNotice(null)}><X size={14} aria-hidden="true" /></button></div>}
    <div className="spreadsheet-sheet-tools" aria-label="Spreadsheet view toolbar"><span className="spreadsheet-sheet-tool-pill"><Table2 size={14} aria-hidden="true" /> Catalog</span><span className="spreadsheet-sheet-tool-divider" aria-hidden="true" /><span>100%</span><span className="spreadsheet-sheet-tool-pill is-view-only">Structured catalog</span><span className="spreadsheet-sheet-tools-spacer" /><span className="spreadsheet-sheet-tool-note">Product styles · Prices · Platforms</span></div>
    <div className="spreadsheet-formula-bar" aria-hidden="true"><span className="spreadsheet-cell-reference">A1</span><span className="spreadsheet-formula-fx">fx</span><span className="spreadsheet-formula-value">RIVORA STYLE CATALOG</span></div>

    <section className="spreadsheet-content">
      <div className="spreadsheet-title-row">
        <div><p className="spreadsheet-eyebrow"><Table2 size={16} /> PRODUCT CATALOG</p><h1>RIVORA Style Catalog</h1><p className="spreadsheet-subtitle">Browse product styles, compare prices and find buying platforms.</p></div>
      </div>

      <div className="spreadsheet-toolbar" aria-label="Catalog filters">
        <label className="spreadsheet-select spreadsheet-control-category">
          <LayoutGrid className="spreadsheet-control-icon" size={21} strokeWidth={1.9} aria-hidden="true" />
          <span className="spreadsheet-select-label">Category</span>
          <span className="spreadsheet-select-value">{selectedCategoryLabel}</span>
          <select aria-label="Category" value={view.category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categoryOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <ChevronDown className="spreadsheet-select-chevron" size={16} aria-hidden="true" />
        </label>
        <div className={`spreadsheet-select spreadsheet-control-platform ${view.platform ? "has-selection" : "is-priority"}`}>
          <PlatformPicker platforms={platforms} value={view.platform} onChange={setPlatform} />
        </div>
        <label className="spreadsheet-select spreadsheet-sort">
          <ArrowDownWideNarrow className="spreadsheet-control-icon" size={21} strokeWidth={1.9} aria-hidden="true" />
          <span className="spreadsheet-select-label">Sort</span>
          <span className="spreadsheet-select-value">{{ random: "Random", "price-low": "Price: Low to High", "price-high": "Price: High to Low", name: "Name", recent: "Recently checked" }[view.sort]}</span>
          <select aria-label="Sort" value={view.sort} onChange={(event) => setSort(event.target.value as CatalogSort)}><option value="random">Random</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="name">Name</option><option value="recent">Recently checked</option></select>
          <ChevronDown className="spreadsheet-select-chevron" size={16} aria-hidden="true" />
        </label>
      </div>
      <div className="spreadsheet-platform-callout" role="note"><Store size={16} aria-hidden="true" /><span><strong>Choose a platform</strong><small>Filter the table by buying source to compare available sellers and prices.</small><strong className="spreadsheet-platform-outage-label">PLATFORM SERVICE ALERT</strong><small className="spreadsheet-platform-maintenance">AcBuy and Multbuy are currently unavailable while under maintenance.</small><small className="spreadsheet-platform-alternative">Recommended alternatives: Oopbuy, Sugargoo, Superbuy, or another available platform below.</small></span><b>{view.platform ? "FILTER ACTIVE" : "RECOMMENDED"}</b></div>
      <div className="spreadsheet-availability-notice" role="status"><strong>Fragrance is temporarily unavailable.</strong><span>Please explore Accessories, Watches, Bags, or Clothing instead.</span><div><Link href="/spreadsheet1?view=styles&category=ACC">Accessories</Link><Link href="/spreadsheet1?view=styles&category=watches">Watches</Link><Link href="/spreadsheet1?view=styles&category=bags">Bags</Link><Link href="/spreadsheet1?view=styles&category=clothing">Clothing</Link></div></div>

      <div className="spreadsheet-column-labels" aria-hidden="true">{["A", "B", "C", "D", "E", "F", "G", "H"].map((column) => <span key={column}>{column}</span>)}</div>
      <div className="spreadsheet-quick-categories" role="group" aria-label="Quick category filters" aria-busy={quickCategoryBusy}>
        <span className="spreadsheet-quick-category-label"><strong>Product Categories</strong><small>Click a tile to filter the catalog</small></span>
        <div className="spreadsheet-quick-category-buttons">{quickCategories.map((item) => {
          const active = view.category === item.key;
          const pending = quickCategoryBusy && pendingQuickCategory === item.key;
          return <button key={item.key} type="button" className={[active ? "is-active" : "", pending ? "is-loading" : ""].filter(Boolean).join(" ")} aria-pressed={active} aria-busy={pending} disabled={loading || quickCategoryBusy} onClick={() => setQuickCategory(active ? "" : item.key, item.key)}><img className="spreadsheet-quick-category-image" src={item.thumbnail} alt="" aria-hidden="true" loading="lazy" decoding="async" /><span className="spreadsheet-quick-category-button-label"><strong>{item.label}</strong>{pending ? <span className="spreadsheet-quick-category-spinner" aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}</span></button>;
        })}</div>
      </div>

      <div className="spreadsheet-results" aria-live="polite" aria-busy={loading}><span className="spreadsheet-results-status">{loading && <span className="spreadsheet-loader spreadsheet-results-loader" aria-hidden="true" />}{loading ? quickCategoryBusy && pendingQuickCategory && view.category === pendingQuickCategory ? `Loading ${quickCategoryOptions.find((item) => item.key === pendingQuickCategory)?.label}…` : "Loading catalog…" : countLabel}</span>{(view.category || view.platform || view.sort !== "random") && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>

      {error ? <section className="spreadsheet-state" role="alert"><h2>Catalog data is temporarily unavailable.</h2><p>{error}</p><button type="button" onClick={() => { catalogIndexPromise = null; setError(""); setPayload(null); setMeta(null); window.location.reload(); }}>Retry</button></section>
        : loading && rows.length === 0 ? <div className="spreadsheet-state" role="status"><span className="spreadsheet-loader" /> Loading catalog…</div>
          : !loading && payload?.total === 0 ? <section className="spreadsheet-state"><h2>No matching styles found.</h2><p>Try another combination or clear the filters.</p><button type="button" onClick={clearFilters}>Clear filters</button></section>
            : <>
              <div className="spreadsheet-directory-layout" ref={directoryLayoutRef}>
              <div className="spreadsheet-directory-main">
              <div className="spreadsheet-table-wrap">
                <table className="spreadsheet-table">
                  <thead><tr><th scope="col">Image</th><th scope="col">Product</th><th scope="col">Style</th><th scope="col">Sizes</th><th scope="col">Price</th><th scope="col">Category</th><th scope="col">Platform</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>{rows.map((item) => {
                    const expanded = expandedItemId === item.id;
                    const displayItem = rowDisplayItem(item, expanded);
                    return <Fragment key={item.id}>
                      <tr>
                        <td className="spreadsheet-image-cell"><button className="spreadsheet-thumb-button" type="button" onClick={() => setImagePreviewItem(displayItem)} aria-label={`View original image: ${displayItem.name}${displayItem.styleLabel ? `, Style ${displayStyleLabel(displayItem.styleLabel)}` : ""}`}><ImageThumb item={displayItem} /></button></td>
                        <td className="spreadsheet-product-cell"><button type="button" className="spreadsheet-product-trigger" onClick={() => toggleInlinePreview(item)} aria-label={`${expanded ? "Hide" : "View"} purchase options for ${item.name}`} aria-expanded={expanded} aria-controls={`desktop-inline-preview-${item.id}`}><strong title={item.name}>{item.name}</strong><small>{item.sourceProductId}</small></button></td>
                        <td>{displayItem.styleLabel && displayStyleLabel(displayItem.styleLabel) ? <span className="spreadsheet-style-tag">Style {displayStyleLabel(displayItem.styleLabel)}</span> : <span className="spreadsheet-muted">—</span>}</td>
                        <td>{item.sizeCount ? `${item.sizeCount} sizes` : <span className="spreadsheet-muted">Options not listed</span>}</td>
                        <td className="spreadsheet-price">{formatMoney(displayItem.price, displayItem.currency)}</td>
                        <td><span className="spreadsheet-category">{categories.find((entry) => entry.key === item.category)?.label || item.category}</span></td>
                        <td><span className="spreadsheet-platform">{primaryPlatformLabelFor(item)}</span><small className="spreadsheet-platform-count">{item.platformCount} platforms</small></td>
                        <td><button className="spreadsheet-view" type="button" onClick={() => toggleInlinePreview(item)} aria-label={`${expanded ? "Hide" : "Preview purchase options for"} ${item.name}`} aria-expanded={expanded} aria-controls={`desktop-inline-preview-${item.id}`} aria-pressed={expanded}>{expanded ? "Hide" : "View"} {expanded ? <ChevronDown size={14} className="is-expanded" /> : <ArrowRight size={14} />}</button></td>
                      </tr>
                      {expanded && <tr className="spreadsheet-expanded-row"><td className="spreadsheet-expanded-cell" colSpan={8}><div id={`desktop-inline-preview-${item.id}`}>{renderInlinePurchaseCard(item)}</div></td></tr>}
                    </Fragment>;
                  })}</tbody>
                </table>
              </div>

              <div className="spreadsheet-mobile-list">{rows.map((item) => {
                const expanded = expandedItemId === item.id;
                const displayItem = rowDisplayItem(item, expanded);
                return <article className="spreadsheet-mobile-row" key={item.id}>
                  <button className="spreadsheet-mobile-image spreadsheet-thumb-button" type="button" onClick={() => setImagePreviewItem(displayItem)} aria-label={`View original image: ${displayItem.name}${displayItem.styleLabel ? `, Style ${displayStyleLabel(displayItem.styleLabel)}` : ""}`}><ImageThumb item={displayItem} /></button>
                  <div className="spreadsheet-mobile-info"><button type="button" className="spreadsheet-product-trigger" onClick={() => toggleInlinePreview(item)} aria-label={`${expanded ? "Hide" : "View"} purchase options for ${item.name}`} aria-expanded={expanded} aria-controls={`mobile-inline-preview-${item.id}`}><strong>{item.name}</strong></button><span>{displayItem.styleLabel ? `Style ${displayItem.styleLabel}` : "Style not specified"} · {categories.find((entry) => entry.key === item.category)?.label || item.category}</span><span>{item.sizeCount ? `${item.sizeCount} sizes` : "Options not listed"} · {view.platform ? `${primaryPlatformLabelFor(item)} · ` : ""}{item.platformCount} platforms</span><strong className="spreadsheet-mobile-price">{formatMoney(displayItem.price, displayItem.currency)}</strong></div>
                  <button className="spreadsheet-mobile-view" type="button" onClick={() => toggleInlinePreview(item)} aria-label={`${expanded ? "Hide" : "Preview purchase options for"} ${item.name}`} aria-expanded={expanded} aria-controls={`mobile-inline-preview-${item.id}`} aria-pressed={expanded}>{expanded ? "Hide" : "View"} {expanded ? <ChevronDown size={14} className="is-expanded" /> : <ArrowRight size={14} />}</button>
                  {expanded && <div className="spreadsheet-mobile-expanded" id={`mobile-inline-preview-${item.id}`}>{renderInlinePurchaseCard(item)}</div>}
                </article>;
              })}</div>

              </div>

              <div className="spreadsheet-pagination"><span>Page {payload?.page || view.page} of {pageCount}</span><div><button type="button" onClick={() => setPage(Math.max(1, (payload?.page || view.page) - 1))} disabled={(payload?.page || view.page) <= 1}><ArrowLeft size={14} /> Previous</button><button type="button" onClick={() => setPage(Math.min(pageCount, (payload?.page || view.page) + 1))} disabled={(payload?.page || view.page) >= pageCount}>Next <ArrowRight size={14} /></button></div></div>
              </div>
            </>}
      <footer className="spreadsheet-footer"><span>RIVORA · STYLE CATALOG</span><span>{countLabel || "Browse the catalog"}</span></footer>
    </section>

    {imagePreviewItem && <div className="spreadsheet-lightbox" role="presentation" onMouseDown={() => setImagePreviewItem(null)}>
      <section className="spreadsheet-lightbox-panel" role="dialog" aria-modal="true" aria-label="Original product image" onMouseDown={(event) => event.stopPropagation()}>
        <button className="spreadsheet-lightbox-close" type="button" onClick={() => setImagePreviewItem(null)} aria-label="Close image preview"><X size={22} /></button>
        <img className="spreadsheet-lightbox-image" src={previewUrl} alt={previewAlt} onError={(event) => { event.currentTarget.src = placeholder; }} />
        <div className="spreadsheet-lightbox-caption"><span>{previewAlt}</span><a href={previewUrl} target="_blank" rel="noreferrer">Open original <ExternalLink size={15} /></a></div>
      </section>
    </div>}

    <CatalogEntryChooser sourcePath="/spreadsheet1" onChoose={(choice) => { if (choice === "product-site") setLocation("/"); }} />
  </main>;
}
