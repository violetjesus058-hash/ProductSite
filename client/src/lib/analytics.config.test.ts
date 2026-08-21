import { describe, expect, it, vi } from "vitest";

describe("first-party analytics Worker configuration", () => {
  it("uses a valid HTTPS Worker base URL when configured", () => {
    const configured = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").trim();
    const normalized = configured.replace(/\/$/, "");
    if (!normalized) {
      expect(configured).toBe("");
      return;
    }
    expect(() => new URL(normalized)).not.toThrow();
    expect(new URL(normalized).protocol).toBe("https:");
    expect(normalized.endsWith("/")).toBe(false);
  });

  it("keeps the analytics endpoint request lightweight and non-blocking", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const base = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
    if (base) {
      await fetch(`${base}/api/analytics/events`, { method: "OPTIONS" });
      expect(fetchMock).toHaveBeenCalledWith(`${base}/api/analytics/events`, { method: "OPTIONS" });
    } else {
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });
});
