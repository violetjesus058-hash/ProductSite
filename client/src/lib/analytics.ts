export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

type UmamiClient = {
  track: (eventName: string, properties?: AnalyticsProperties) => void;
};

declare global {
  interface Window {
    umami?: UmamiClient;
  }
}

const ANONYMOUS_ID_KEY = "productsite:analytics:anonymous-id:v1";
const SESSION_ID_KEY = "productsite:analytics:session-id:v1";
const ATTRIBUTION_KEY = "productsite:analytics:attribution:v1";
const SENT_EVENT_KEY = "productsite:analytics:sent-events:v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getOrCreate(storage: Storage, key: string, prefix: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = randomId(prefix);
  storage.setItem(key, value);
  return value;
}

function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY) || "{}");
    return saved && typeof saved === "object" ? saved as Attribution : {};
  } catch {
    return {};
  }
}

function captureAttribution() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const current = readAttribution();
  const next: Attribution = { ...current };
  UTM_KEYS.forEach((key) => {
    const value = params.get(key)?.trim();
    if (value) next[key] = value.slice(0, 120);
  });
  if (Object.keys(next).length > 0) window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
}

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");

function contextProperties(): AnalyticsProperties {
  if (typeof window === "undefined") return {};
  captureAttribution();
  const anonymousId = getOrCreate(window.localStorage, ANONYMOUS_ID_KEY, "anon");
  const sessionId = getOrCreate(window.sessionStorage, SESSION_ID_KEY, "session");
  const attribution = readAttribution();
  return {
    anonymous_id: anonymousId,
    session_id: sessionId,
    page_path: window.location.pathname,
    device: window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop",
    language: document.documentElement.lang || navigator.language || "en",
    ...attribution,
  };
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;
  const context = contextProperties();
  const payload = { ...context, ...properties };
  try {
    window.umami?.track(eventName, payload);
  } catch {
    // Analytics must never interrupt catalog browsing.
  }
  if (workerUrl) {
    const ownEvent = {
      event_name: eventName,
      anonymous_id: payload.anonymous_id,
      session_id: payload.session_id,
      occurred_at: new Date().toISOString(),
      path: payload.page_path,
      referrer: document.referrer || null,
      utm_source: payload.utm_source,
      utm_medium: payload.utm_medium,
      utm_campaign: payload.utm_campaign,
      device: payload.device,
      language: payload.language,
      product_id: payload.product_id,
      source_product_id: payload.source_product_id,
      category: payload.category,
      brand: payload.brand,
      platform: payload.platform,
      query: payload.query,
      list_type: payload.list_type,
      position: payload.position,
      properties: Object.fromEntries(Object.entries(properties).slice(0, 24)),
    };
    void fetch(`${workerUrl}/api/analytics/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [ownEvent] }),
      keepalive: true,
    }).catch(() => undefined);
  }
}

export function trackOnce(eventName: string, key: string, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return;
  try {
    const sent = new Set(JSON.parse(window.sessionStorage.getItem(SENT_EVENT_KEY) || "[]") as unknown[]);
    const eventKey = `${eventName}:${key}`;
    if (sent.has(eventKey)) return;
    sent.add(eventKey);
    window.sessionStorage.setItem(SENT_EVENT_KEY, JSON.stringify(Array.from(sent).slice(-500)));
    trackEvent(eventName, properties);
  } catch {
    trackEvent(eventName, properties);
  }
}

export function initializeAnalytics() {
  if (typeof window === "undefined") return;
  captureAttribution();
  trackOnce("session_start", "session", { referrer: document.referrer ? "external_or_previous" : "direct" });
}
