import { describe, expect, it } from "vitest";
import { analyticsEventName, analyticsOccurredAt, analyticsRowInput, detectBrowser, detectDevice, detectOperatingSystem, makeRequestCode, maskIp, validUrl } from "./index";

describe("Cloudflare product request helpers", () => {
  it("creates a stable request code shape", () => {
    expect(makeRequestCode()).toMatch(/^REQ-\d{8}-[A-Z0-9]{6}$/);
  });

  it("accepts http(s) product links and rejects unsafe protocols", () => {
    expect(validUrl("https://example.com/item")).toBe(true);
    expect(validUrl("http://example.com/item")).toBe(true);
    expect(validUrl("")).toBe(true);
    expect(validUrl("javascript:alert(1)")).toBe(false);
    expect(validUrl("not-a-url")).toBe(false);
  });

  it("masks IPv4 and IPv6 addresses before admin display", () => {
    expect(maskIp("203.0.113.42")).toBe("203.0.113.0");
    expect(maskIp("2001:db8:abcd:0012::1")).toBe("2001:db8::");
  });

  it("validates analytics event names and normalizes timestamps", () => {
    expect(analyticsEventName("product_click")).toBe("product_click");
    expect(analyticsEventName("Product Click")).toBeNull();
    expect(analyticsEventName("../admin")).toBeNull();
    expect(analyticsOccurredAt("2026-08-21T00:00:00.000Z")).toBe("2026-08-21T00:00:00.000Z");
  });

  it("keeps analytics payload anonymous and bounded", () => {
    const row = analyticsRowInput({ event_name: "product_click", anonymous_id: "a".repeat(200), session_id: "s-1", product_id: "p-1", position: 4, properties: { platform: "Kakobuy" } });
    expect(row).toHaveProperty("value");
    if ("value" in row) {
      expect(row.value.anonymousId).toHaveLength(100);
      expect(row.value.position).toBe(4);
      expect(row.value.propertiesJson).toContain("Kakobuy");
    }
  });

  it("detects common visitor metadata from User-Agent", () => {
    const chromeWindows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36";
    expect(detectDevice(chromeWindows)).toBe("Desktop");
    expect(detectBrowser(chromeWindows)).toBe("Chrome");
    expect(detectOperatingSystem(chromeWindows)).toBe("Windows");

    const safariIphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
    expect(detectDevice(safariIphone)).toBe("Mobile");
    expect(detectBrowser(safariIphone)).toBe("Safari");
    expect(detectOperatingSystem(safariIphone)).toBe("iOS");
  });
});
