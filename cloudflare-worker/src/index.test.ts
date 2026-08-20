import { describe, expect, it } from "vitest";
import { makeRequestCode, validUrl } from "./index";

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
});
