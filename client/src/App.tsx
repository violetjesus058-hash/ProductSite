// Editorial Pinboard reminder: fixed catalog rail, editorial typography, ink-on-paper palette, coral interaction signal.
import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { getSiteLanguage } from "./lib/siteLanguage";
const Home = lazy(() => import("./pages/Home"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const AdminRequests = lazy(() => import("./pages/AdminRequests"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const PromotionLinkBuilder = lazy(() => import("./pages/PromotionLinkBuilder"));
const AdminProductImport = lazy(() => import("./pages/AdminProductImport"));
const RequestStatus = lazy(() => import("./pages/RequestStatus"));
const SpreadsheetCatalog = lazy(() => import("./pages/SpreadsheetCatalog"));
const SpreadsheetCatalog1 = lazy(() => import("./pages/SpreadsheetCatalog1"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  const [location] = useLocation();
  const [, setCatalogVersion] = useState(0);
  useEffect(() => { document.documentElement.lang = location.startsWith("/admin") ? "zh-CN" : getSiteLanguage(); }, [location]);
  useEffect(() => {
    if (location === "/spreadsheet") return;
    if (!(location === "/" || location.startsWith("/product/") || location.startsWith("/admin/products/import"))) return;
    const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
    if (!workerUrl) return;
    fetch(`${workerUrl}/api/products/overrides`).then((response) => response.ok ? response.json() : null).then(async (payload) => {
      const overrides: Array<Record<string, unknown> & { id?: string }> = Array.isArray(payload?.items) ? payload.items : [];
      if (!overrides.length) return;
      const { products } = await import("./data/catalogProducts");
      const byId = new Map(overrides.map((item: { id?: unknown }) => [String(item.id || ""), item]));
      const merged = products.map((product) => { const override = byId.get(product.id); return override ? { ...product, ...override } as typeof product : product; });
      const existingIds = new Set(products.map((product) => product.id));
      const additions = overrides.filter((item) => item.id && !existingIds.has(String(item.id))) as unknown as typeof products;
      products.splice(0, products.length, ...merged, ...additions);
      setCatalogVersion((value) => value + 1);
    }).catch(() => undefined);
  }, [location]);
  useEffect(() => {
    const preventImageDrag = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "IMG") event.preventDefault();
    };
    const preventImageContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "IMG") event.preventDefault();
    };
    document.addEventListener("dragstart", preventImageDrag);
    document.addEventListener("contextmenu", preventImageContextMenu);
    return () => {
      document.removeEventListener("dragstart", preventImageDrag);
      document.removeEventListener("contextmenu", preventImageContextMenu);
    };
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/spreadsheet" component={SpreadsheetCatalog} />
              <Route path="/spreadsheet1" component={SpreadsheetCatalog1} />
              <Route path="/product/:id" component={ProductDetail} />
              <Route path="/admin/requests" component={AdminRequests} />
              <Route path="/admin/analytics" component={AdminAnalytics} />
              <Route path="/admin/promotion-links" component={PromotionLinkBuilder} />
              <Route path="/admin/products/import" component={AdminProductImport} />
              <Route path="/requests/status" component={RequestStatus} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
