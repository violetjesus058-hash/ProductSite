import { useEffect, useMemo, useState } from "react";

const FALLBACK_IMAGE = "/catalog-detail-stilllife.jpg";

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

export default function SafeProductImage({ sources = [], alt, className, loading = "lazy" }: SafeProductImageProps) {
  const normalizedSources = useMemo(() => {
    const unique = Array.from(new Set(sources.map((source) => String(source || "").trim()).filter(Boolean)));
    return unique.length ? unique : [FALLBACK_IMAGE];
  }, [sources]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setFailedAll(false);
  }, [normalizedSources]);

  const source = failedAll ? FALLBACK_IMAGE : normalizedSources[sourceIndex] || FALLBACK_IMAGE;

  return (
    <img
      src={source}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (sourceIndex < normalizedSources.length - 1) setSourceIndex((index) => nextSafeImageSource(normalizedSources, index).index);
        else if (source !== FALLBACK_IMAGE) setFailedAll(true);
      }}
    />
  );
}

export { FALLBACK_IMAGE };
