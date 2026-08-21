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
  try {
    window.umami?.track(eventName, { ...contextProperties(), ...properties });
  } catch {
    // Analytics must never interrupt catalog browsing.
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
