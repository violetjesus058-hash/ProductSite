import { useEffect, useMemo, useState } from "react";

const FALLBACK_IMAGE = "/catalog-detail-stilllife.jpg";
const IMAGE_CACHE_NAME = "productsite-images-v1";

export function nextSafeImageSource(sources: string[], currentIndex: number, fallback = FALLBACK_IMAGE) {
  const nextIndex = currentIndex + 1;
  return nextIndex < sources.length ? { source: sources[nextIndex], index: nextIndex, failedAll: false } : { source: fallback, index: currentIndex, failedAll: true };
}

type SafeProductImageProps = {
  sources?: string[];
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  responsive?: boolean;
  sizes?: string;
  fixedThumbnailSize?: 320 | 640;
  fetchPriority?: "high" | "low" | "auto";
};

function canCacheImages() {
  return typeof window !== "undefined" && "caches" in window;
}

async function readCachedImage(source: string) {
  if (!canCacheImages() || !/^https?:/i.test(source)) return null;
  try {
    const cache = await window.caches.open(IMAGE_CACHE_NAME);
    const response = await cache.match(source);
    if (!response) return null;
    const blob = await response.blob();
    return blob.size > 0 ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

async function primeImageCache(source: string) {
  if (!canCacheImages() || !/^https?:/i.test(source)) return;
  try {
    const cache = await window.caches.open(IMAGE_CACHE_NAME);
    if (await cache.match(source)) return;
    const response = await fetch(source, { mode: "cors", cache: "no-cache" });
    if (response.ok && response.type !== "opaque") await cache.put(source, response.clone());
  } catch {
    // The original image URL remains the fallback when CORS or Cache Storage is unavailable.
  }
}

export default function SafeProductImage({ sources = [], alt, className, loading = "lazy", responsive = false, sizes, fixedThumbnailSize, fetchPriority = "auto" }: SafeProductImageProps) {
  const normalizedSources = useMemo(() => {
    const unique = Array.from(new Set(sources.map((source) => String(source || "").trim()).filter(Boolean)));
    return unique.length ? unique : [FALLBACK_IMAGE];
  }, [sources]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const source = failedAll ? FALLBACK_IMAGE : normalizedSources[sourceIndex] || FALLBACK_IMAGE;
  const thumbnailSource = (value: string, size: 320 | 640) => value.startsWith("/product-images/") && !value.includes("/thumb-")
    ? value.replace("/product-images/", `/product-images/thumb-${size}/`)
    : value;
  const useThumbnail = responsive && !thumbnailFailed && source !== FALLBACK_IMAGE;
  const desiredThumbnailSize = fixedThumbnailSize || 320;
  const desiredSource = useThumbnail ? thumbnailSource(source, desiredThumbnailSize) : source;
  const displaySrcSet = useThumbnail && !fixedThumbnailSize ? `${thumbnailSource(source, 320)} 320w, ${thumbnailSource(source, 640)} 640w` : undefined;
  const [displaySource, setDisplaySource] = useState(source);

  useEffect(() => {
    setSourceIndex(0);
    setFailedAll(false);
    setThumbnailFailed(false);
  }, [normalizedSources]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setDisplaySource(desiredSource);
    void readCachedImage(desiredSource).then((cachedSource) => {
      if (!cachedSource) return;
      objectUrl = cachedSource;
      if (active) setDisplaySource(cachedSource);
      else URL.revokeObjectURL(cachedSource);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [desiredSource]);

  return (
    <img
      src={displaySource}
      srcSet={displaySrcSet}
      sizes={responsive ? (sizes || "(max-width: 760px) 46vw, 241px") : undefined}
      alt={alt}
      className={className}
      width={600}
      height={750}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onLoad={() => void primeImageCache(desiredSource)}
      onError={() => {
        if (useThumbnail) setThumbnailFailed(true);
        else if (sourceIndex < normalizedSources.length - 1) setSourceIndex((index) => nextSafeImageSource(normalizedSources, index).index);
        else if (source !== FALLBACK_IMAGE) setFailedAll(true);
      }}
    />
  );
}

export { FALLBACK_IMAGE };
