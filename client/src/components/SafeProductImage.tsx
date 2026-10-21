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

export default function SafeProductImage({ sources = [], alt, className, loading = "lazy" }: SafeProductImageProps) {
  const normalizedSources = useMemo(() => {
    const unique = Array.from(new Set(sources.map((source) => String(source || "").trim()).filter(Boolean)));
    return unique.length ? unique : [FALLBACK_IMAGE];
  }, [sources]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const source = failedAll ? FALLBACK_IMAGE : normalizedSources[sourceIndex] || FALLBACK_IMAGE;
  const [displaySource, setDisplaySource] = useState(source);

  useEffect(() => {
    setSourceIndex(0);
    setFailedAll(false);
  }, [normalizedSources]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setDisplaySource(source);
    void readCachedImage(source).then((cachedSource) => {
      if (!cachedSource) return;
      objectUrl = cachedSource;
      if (active) setDisplaySource(cachedSource);
      else URL.revokeObjectURL(cachedSource);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return (
    <img
      src={displaySource}
      alt={alt}
      className={className}
      width={600}
      height={750}
      loading={loading}
      onLoad={() => void primeImageCache(source)}
      onError={() => {
        if (sourceIndex < normalizedSources.length - 1) setSourceIndex((index) => nextSafeImageSource(normalizedSources, index).index);
        else if (source !== FALLBACK_IMAGE) setFailedAll(true);
      }}
    />
  );
}

export { FALLBACK_IMAGE };
