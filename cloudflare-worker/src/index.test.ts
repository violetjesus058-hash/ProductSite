import { describe, expect, it } from "vitest";
import { detectBrowser, detectDevice, detectOperatingSystem, makeRequestCode, maskIp, validUrl } from "./index";

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
