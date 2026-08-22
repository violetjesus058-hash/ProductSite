// Editorial Pinboard reminder: fixed catalog rail, editorial typography, ink-on-paper palette, coral interaction signal.
import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { products } from "./data/products";
import ProductDetail from "./pages/ProductDetail";
import AdminRequests from "./pages/AdminRequests";
import AdminAnalytics from "./pages/AdminAnalytics";
import PromotionLinkBuilder from "./pages/PromotionLinkBuilder";
import AdminProductImport from "./pages/AdminProductImport";
import RequestStatus from "./pages/RequestStatus";
import NotFound from "./pages/NotFound";

export default function App() {
  const [, setCatalogVersion] = useState(0);
  useEffect(() => {
    const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
    if (!workerUrl) return;
    fetch(`${workerUrl}/api/products/overrides`).then((response) => response.ok ? response.json() : null).then((payload) => {
      const overrides: Array<Record<string, unknown> & { id?: string }> = Array.isArray(payload?.items) ? payload.items : [];
      if (!overrides.length) return;
      const byId = new Map(overrides.map((item: { id?: unknown }) => [String(item.id || ""), item]));
      const merged = products.map((product) => { const override = byId.get(product.id); return override ? { ...product, ...override } as typeof product : product; });
      const existingIds = new Set(products.map((product) => product.id));
      const additions = overrides.filter((item) => item.id && !existingIds.has(String(item.id))) as unknown as typeof products;
      products.splice(0, products.length, ...merged, ...additions);
      setCatalogVersion((value) => value + 1);
    }).catch(() => undefined);
  }, []);
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
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/product/:id" component={ProductDetail} />
            <Route path="/admin/requests" component={AdminRequests} />
            <Route path="/admin/analytics" component={AdminAnalytics} />
            <Route path="/admin/promotion-links" component={PromotionLinkBuilder} />
            <Route path="/admin/products/import" component={AdminProductImport} />
            <Route path="/requests/status" component={RequestStatus} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
