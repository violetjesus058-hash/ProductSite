import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, ExternalLink } from "lucide-react";
import "./product-detail-1.css";
import { platformIconFor, platformSourcesFor, type PlatformSource } from "@/lib/platformSources.mjs";
import { displayStyleLabel } from "@/data/style-label-map";

type DetailStyle = {
  id: string;
  styleKey: string;
  styleLabel: string;
  price: number;
  currency: string;
  sizes: string[];
  colors: string[];
  stock: string;
  images: string[];
  description: string;
};

type ProductDetailPayload = {
  sourceProductId: string;
  name: string;
  catalogName: string;
  brand: string;
  category: string;
  subCategory: string;
  shopUrl: string;
  productUrl: string;
  refreshed: string;
  gallery: string[];
  styles: DetailStyle[];
};

const basePath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/catalog-data-1`;

function formatMoney(value: number, currency: string) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function categoryLabel(value: string) {
  if (!value) return "";
  const map: Record<string, string> = { clothing: "Clothing", shoe: "Shoes", pants: "Pants", bags: "Bags", watches: "Watches", ACC: "Accessories", fragrance: "Fragrance" };
  return map[value] || value;
}

export default function ProductDetail1() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ProductDetailPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [styleIndex, setStyleIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setStyleIndex(0);
    setImageIndex(0);
    fetch(`${basePath}/products/${encodeURIComponent(id)}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Product ${id} was not found in this catalog.`);
        return response.json();
      })
      .then((payload: ProductDetailPayload) => {
        if (cancelled) return;
        setDetail(payload);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setError(reason instanceof Error ? reason.message : "Could not load this product.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const styles = detail?.styles || [];
  const selectedStyle = styles[Math.min(styleIndex, Math.max(styles.length - 1, 0))];
  const images = selectedStyle?.images?.length ? selectedStyle.images : detail?.gallery || [];
  const activeImage = images[Math.min(imageIndex, Math.max(images.length - 1, 0))] || "";

  const platforms: PlatformSource[] = useMemo(() => {
    if (!detail) return [];
    return platformSourcesFor({ id: detail.styles[0]?.id || detail.sourceProductId, sourceProductId: detail.sourceProductId }) as PlatformSource[];
  }, [detail]);

  const visiblePlatforms = showAllPlatforms ? platforms : platforms.slice(0, 6);

  function selectStyle(index: number) {
    setStyleIndex(index);
    setImageIndex(0);
  }

  return <div className="pd1-page">
    <header className="pd1-header">
      <Link className="pd1-back" href="/spreadsheet1"><ArrowLeft size={15} aria-hidden="true" /> Back to catalog table</Link>
      <span className="pd1-header-meta">Style catalog · updated {detail?.refreshed || "—"}</span>
    </header>

    {loading && <section className="pd1-state" role="status"><span className="pd1-loader" /> Loading product…</section>}

    {!loading && error && <section className="pd1-state is-error" role="alert">
      <h1>Product not available</h1>
      <p>{error}</p>
      <Link className="pd1-state-link" href="/spreadsheet1">Return to catalog</Link>
    </section>}

    {!loading && !error && detail && selectedStyle && <main className="pd1-main">
      <section className="pd1-gallery">
        <div className="pd1-main-image">
          {activeImage ? <img src={activeImage} alt={`${detail.name}${selectedStyle.styleLabel ? `, style ${selectedStyle.styleLabel}` : ""}`} /> : <div className="pd1-image-fallback">Image unavailable</div>}
        </div>
        {images.length > 1 && <div className="pd1-thumbs" role="group" aria-label="Product images">
          {images.slice(0, 12).map((image, index) => <button key={`${image}-${index}`} type="button" className={index === imageIndex ? "is-active" : ""} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}>
            <img src={image} alt="" loading="lazy" />
          </button>)}
        </div>}
      </section>

      <section className="pd1-info">
        <div className="pd1-eyebrow"><span>{categoryLabel(detail.category)}{detail.subCategory ? ` · ${detail.subCategory}` : ""}</span><span>{detail.brand || "Unbranded"}</span></div>
        <h1 className="pd1-title">{detail.name}</h1>
        <div className="pd1-price">{formatMoney(selectedStyle.price, selectedStyle.currency)}</div>

        {styles.length > 1 && <div className="pd1-styles">
          <div className="pd1-section-heading"><span>STYLE</span><small>{styles.length} options</small></div>
          <div className="pd1-style-list" role="group" aria-label="Choose a style">
            {styles.map((style, index) => {
              const label = displayStyleLabel(style.styleLabel);
              return <button key={style.id} type="button" className={index === styleIndex ? "is-selected" : ""} aria-pressed={index === styleIndex} onClick={() => selectStyle(index)}>
                {label ? `Style ${label}` : `Style ${index + 1}`}
                <small>{formatMoney(style.price, style.currency)}</small>
              </button>;
            })}
          </div>
        </div>}

        <dl className="pd1-facts">
          <div><dt>Sizes</dt><dd>{selectedStyle.sizes.length ? selectedStyle.sizes.join(", ") : "Not listed"}</dd></div>
          <div><dt>Colors</dt><dd>{selectedStyle.colors.length ? selectedStyle.colors.join(", ") : "Not listed"}</dd></div>
          <div><dt>Stock</dt><dd>{selectedStyle.stock || "Unknown"}</dd></div>
          <div><dt>Style ID</dt><dd className="pd1-mono">{selectedStyle.id}</dd></div>
        </dl>

        <p className="pd1-description">{selectedStyle.description || detail.name}</p>

        <div className="pd1-source-actions">
          <a className="pd1-primary-action" href={detail.productUrl} target="_blank" rel="noopener noreferrer">Open on Kakobuy <ArrowUpRight size={15} aria-hidden="true" /></a>
          {detail.shopUrl && <a className="pd1-secondary-action" href={detail.shopUrl} target="_blank" rel="noopener noreferrer">Original listing <ExternalLink size={14} aria-hidden="true" /></a>}
        </div>

        <div className="pd1-platforms">
          <div className="pd1-section-heading"><span>BUYING PLATFORMS</span><small>{platforms.length} sources</small></div>
          <div className="pd1-platform-list">
            {visiblePlatforms.map((platform) => {
              const icon = platformIconFor(platform.name);
              const primary = !!platform.primary;
              return <a key={platform.name} href={platform.url} target="_blank" rel="noopener noreferrer" className={`pd1-platform ${primary ? "is-primary" : ""}`}>
                <span className="pd1-platform-identity">
                  {icon ? <img src={icon} alt="" aria-hidden="true" loading="lazy" /> : <i aria-hidden="true">{platform.name.charAt(0).toUpperCase()}</i>}
                  <strong>{platform.name}</strong>
                </span>
                {primary ? <Check size={14} aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />}
              </a>;
            })}
          </div>
          {platforms.length > 6 && <button type="button" className="pd1-more" aria-expanded={showAllPlatforms} onClick={() => setShowAllPlatforms((current) => !current)}>
            {showAllPlatforms ? "Show fewer platforms" : `Show ${platforms.length - 6} more platforms`}
            <ChevronDown size={14} className={showAllPlatforms ? "is-expanded" : ""} aria-hidden="true" />
          </button>}
        </div>
      </section>
    </main>}
  </div>;
}
