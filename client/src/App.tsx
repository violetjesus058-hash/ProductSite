// Editorial Pinboard reminder: fixed catalog rail, editorial typography, ink-on-paper palette, coral interaction signal.
import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import AdminRequests from "./pages/AdminRequests";
import AdminAnalytics from "./pages/AdminAnalytics";
import RequestStatus from "./pages/RequestStatus";
import NotFound from "./pages/NotFound";

export default function App() {
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
            <Route path="/requests/status" component={RequestStatus} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
