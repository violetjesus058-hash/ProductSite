import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent, trackOnce } from "./analytics";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

describe("analytics", () => {
  const track = vi.fn();

  beforeEach(() => {
    track.mockReset();
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage,
      sessionStorage,
      location: { pathname: "/", search: "?utm_source=reddit&utm_campaign=summer" },
      matchMedia: () => ({ matches: false }),
      umami: { track },
    });
    vi.stubGlobal("document", { referrer: "", documentElement: { lang: "en" } });
    vi.stubGlobal("navigator", { language: "en" });
  });

  it("adds anonymous context and UTM attribution without personal fields", () => {
    trackEvent("affiliate_click", { product_id: "p-1", platform: "Kakobuy" });
    expect(track).toHaveBeenCalledTimes(1);
    const [eventName, properties] = track.mock.calls[0];
    expect(eventName).toBe("affiliate_click");
    expect(properties).toMatchObject({ product_id: "p-1", platform: "Kakobuy", utm_source: "reddit", utm_campaign: "summer", device: "desktop" });
    expect(properties).not.toHaveProperty("email");
    expect(properties).not.toHaveProperty("ip");
  });

  it("deduplicates a keyed event within a session", () => {
    trackOnce("product_impression", "p-1", { product_id: "p-1" });
    trackOnce("product_impression", "p-1", { product_id: "p-1" });
    expect(track).toHaveBeenCalledTimes(1);
  });
});
