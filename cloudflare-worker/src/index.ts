export interface Env {
  DB: D1Database;
  ADMIN_API_KEY: string;
  ALLOWED_ORIGIN?: string;
  OVERRIDES_CACHE?: KVNamespace;
  ANALYTICS_CACHE?: KVNamespace;
}

const OVERRIDES_CACHE_KEY = "product_overrides";
const OVERRIDES_CACHE_TTL = 600;       // 10 minutes
const ANALYTICS_CACHE_TTL = 900;        // 15 minutes
const ANALYTICS_CACHE_PAGE = 1;          // only cache the default page=1 result

type RequestRow = {
  id: number;
  request_code: string;
  name: string;
  contact: string | null;
  product_url: string | null;
  image_url: string | null;
  description: string;
  notes: string | null;
  status: string;
  admin_reply: string | null;
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

const statuses = new Set(["Received", "Reviewing", "Accepted", "Closed"]);
const jsonHeaders = { "content-type": "application/json; charset=UTF-8" };
const submissionWindows = new Map<string, number[]>();
const MAX_REQUEST_BYTES = 12_000;
const MAX_SUBMISSIONS_PER_MINUTE = 5;
const analyticsWindows = new Map<string, number[]>();
const MAX_ANALYTICS_EVENTS_PER_MINUTE = 120;
const MAX_ANALYTICS_BATCH = 40;
const MAX_ANALYTICS_BODY_BYTES = 80_000;
const MAX_PRODUCT_IMPORT_ROWS = 5_000;
const MAX_PRODUCT_IMPORT_BODY_BYTES = 3_000_000;
const productTemplateHeaders = ["id", "sourceProductId", "name", "catalogName", "category", "subCategory", "brand", "price", "referencePrice", "currency", "description", "sizes", "colors", "stock", "shop", "shopUrl", "url", "images", "tags", "collectedAt", "reviewStatus", "reviewNote", "platformLinks"];

 type AnalyticsInput = Record<string, unknown>;
 type AnalyticsRow = {
  id: number;
  event_name: string;
  anonymous_id: string | null;
  session_id: string | null;
  occurred_at: string;
  path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device: string | null;
  language: string | null;
  product_id: string | null;
  source_product_id: string | null;
  category: string | null;
  brand: string | null;
  platform: string | null;
  query: string | null;
  list_type: string | null;
  position: number | null;
  properties_json: string | null;
  created_at: string;
 };

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin") || "";
  const isProductSitePagesOrigin = /^https:\/\/[a-z0-9-]+\.productsite-8wf\.pages\.dev$/i.test(origin);
  const configuredOrigin = env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" ? env.ALLOWED_ORIGIN : "";
  const allowed = configuredOrigin && (origin === configuredOrigin || isProductSitePagesOrigin) ? origin : configuredOrigin || (isProductSitePagesOrigin ? origin : origin || "*");
  const headers = new Headers(jsonHeaders);
  headers.set("access-control-allow-origin", allowed);
  headers.set("access-control-allow-headers", "content-type, x-admin-api-key");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  headers.set("vary", "Origin");
  return headers;
}

function response(request: Request, env: Env, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request, env) });
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength)
    : "";
}

function rawClientIp(request: Request) {
  return (request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "anonymous").split(",")[0].trim().slice(0, 120);
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const key = rawClientIp(request);
  const recent = (submissionWindows.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= MAX_SUBMISSIONS_PER_MINUTE) {
    submissionWindows.set(key, recent);
    return true;
  }
  recent.push(now);
  submissionWindows.set(key, recent);
  return false;
}

export function validUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function makeRequestCode() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `REQ-${stamp}-${suffix}`;
}

export function maskIp(ip: string) {
  const value = ip.trim();
  if (!value) return "";
  if (value.includes(".")) {
    const parts = value.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : "匿名 IP";
  }
  if (value.includes(":")) {
    return `${value.split(":").slice(0, 2).join(":")}::`;
  }
  return "匿名 IP";
}

export function detectDevice(ua: string) {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return "Tablet";
  if (/mobile|iphone|android|phone/i.test(ua)) return "Mobile";
  return "Desktop";
}

export function detectBrowser(ua: string) {
  if (/edg\//i.test(ua)) return "Microsoft Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/samsungbrowser\//i.test(ua)) return "Samsung Internet";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua) && !/android/i.test(ua)) return "Safari";
  return "Other";
}

export function detectOperatingSystem(ua: string) {
  if (/windows/i.test(ua)) return "Windows";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os|macintosh/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function requestMetadata(request: Request) {
  const ua = normalizeText(request.headers.get("User-Agent"), 300);
  return {
    ipAddress: maskIp(request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || ""),
    country: normalizeText(request.headers.get("CF-IPCountry"), 80) || null,
    region: normalizeText(request.headers.get("CF-Region"), 120) || null,
    city: normalizeText(request.headers.get("CF-IPCity"), 120) || null,
    deviceType: detectDevice(ua),
    browser: detectBrowser(ua),
    operatingSystem: detectOperatingSystem(ua),
    userAgent: ua || null,
  };
}

export function publicRow(row: RequestRow) {
  return {
    requestCode: row.request_code,
    name: row.name,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    description: row.description,
    status: row.status,
    adminReply: row.admin_reply,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function adminRow(row: RequestRow) {
  return {
    id: row.id,
    requestCode: row.request_code,
    name: row.name,
    contact: row.contact,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    description: row.description,
    notes: row.notes,
    status: row.status,
    adminReply: row.admin_reply,
    ipAddress: row.ip_address,
    country: row.country,
    region: row.region,
    city: row.city,
    deviceType: row.device_type,
    browser: row.browser,
    operatingSystem: row.operating_system,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isAdmin(request: Request, env: Env) {
  const key = request.headers.get("x-admin-api-key");
  return Boolean(env.ADMIN_API_KEY && key && key === env.ADMIN_API_KEY);
}

function analyticsRateLimited(request: Request) {
  const now = Date.now();
  const key = rawClientIp(request);
  const recent = (analyticsWindows.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length + 1 > MAX_ANALYTICS_EVENTS_PER_MINUTE) {
    analyticsWindows.set(key, recent);
    return true;
  }
  recent.push(now);
  analyticsWindows.set(key, recent);
  return false;
}

function analyticsText(value: unknown, maxLength: number) {
  return normalizeText(value, maxLength) || null;
}

export function analyticsEventName(value: unknown) {
  const name = normalizeText(value, 64);
  return /^[a-z][a-z0-9_]{1,63}$/.test(name) ? name : null;
}

export function analyticsOccurredAt(value: unknown) {
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
}

export function analyticsRowInput(input: AnalyticsInput) {
  const eventName = analyticsEventName(input.event_name ?? input.eventName);
  if (!eventName) return { error: "Invalid event name." } as const;
  const properties = input.properties && typeof input.properties === "object" ? input.properties : {};
  let propertiesJson = "{}";
  try { propertiesJson = JSON.stringify(properties).slice(0, 2_000); } catch { propertiesJson = "{}"; }
  const rawPosition = Number(input.position);
  return {
    value: {
      eventName,
      anonymousId: analyticsText(input.anonymous_id ?? input.anonymousId, 100),
      sessionId: analyticsText(input.session_id ?? input.sessionId, 100),
      occurredAt: analyticsOccurredAt(input.occurred_at ?? input.occurredAt),
      path: analyticsText(input.path, 300),
      referrer: analyticsText(input.referrer, 300),
      utmSource: analyticsText(input.utm_source ?? input.utmSource, 120),
      utmMedium: analyticsText(input.utm_medium ?? input.utmMedium, 120),
      utmCampaign: analyticsText(input.utm_campaign ?? input.utmCampaign, 160),
      device: analyticsText(input.device, 40),
      language: analyticsText(input.language, 40),
      productId: analyticsText(input.product_id ?? input.productId, 120),
      sourceProductId: analyticsText(input.source_product_id ?? input.sourceProductId, 120),
      category: analyticsText(input.category, 100),
      brand: analyticsText(input.brand, 120),
      platform: analyticsText(input.platform, 80),
      query: analyticsText(input.query ?? input.search_term ?? input.searchTerm, 160),
      listType: analyticsText(input.list_type ?? input.listType, 80),
      position: Number.isInteger(rawPosition) && rawPosition > 0 && rawPosition <= 10_000 ? rawPosition : null,
      propertiesJson,
    },
  } as const;
}

async function ingestAnalytics(request: Request, env: Env) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_ANALYTICS_BODY_BYTES) return response(request, env, { error: "Analytics payload is too large." }, 413);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return response(request, env, { error: "Unsupported request format." }, 415);
  if (analyticsRateLimited(request)) return response(request, env, { error: "Too many analytics events." }, 429);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_ANALYTICS_BODY_BYTES) return response(request, env, { error: "Analytics payload is too large." }, 413);
  let payload: unknown;
  try { payload = JSON.parse(rawBody || "null"); } catch { return response(request, env, { error: "Invalid analytics payload." }, 400); }
  const inputs = Array.isArray(payload) ? payload : (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).events) ? (payload as Record<string, unknown>).events : [payload]);
  if (inputs.length < 1 || inputs.length > MAX_ANALYTICS_BATCH || inputs.some((item) => !item || typeof item !== "object")) return response(request, env, { error: "Invalid analytics batch." }, 400);
  const rows = inputs.map((item) => analyticsRowInput(item as AnalyticsInput));
  const invalid = rows.find((row) => "error" in row);
  if (invalid && "error" in invalid) return response(request, env, { error: invalid.error }, 400);
  const statements = rows.map((row) => {
    const value = row.value;
    return env.DB.prepare(`INSERT INTO analytics_events (event_name, anonymous_id, session_id, occurred_at, path, referrer, utm_source, utm_medium, utm_campaign, device, language, product_id, source_product_id, category, brand, platform, query, list_type, position, properties_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(value.eventName, value.anonymousId, value.sessionId, value.occurredAt, value.path, value.referrer, value.utmSource, value.utmMedium, value.utmCampaign, value.device, value.language, value.productId, value.sourceProductId, value.category, value.brand, value.platform, value.query, value.listType, value.position, value.propertiesJson);
  });
  await env.DB.batch(statements);
  return response(request, env, { accepted: statements.length }, 202);
}

function beijingDayStartUtc(dayOffset = 0) {
  const beijingNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const beijingDate = new Date(Date.UTC(beijingNow.getUTCFullYear(), beijingNow.getUTCMonth(), beijingNow.getUTCDate() - dayOffset));
  return new Date(beijingDate.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

function beijingDateStartUtc(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function beijingWeekStartUtc() {
  const beijingNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = beijingNow.getUTCDay() || 7;
  return beijingDayStartUtc(day - 1);
}

async function getAnalyticsSummary(request: Request, env: Env) {
  if (!isAdmin(request, env)) return response(request, env, { error: "没有后台访问权限。" }, 401);
  const url = new URL(request.url);
  const requestedRange = url.searchParams.get("range") || "30";
  const validRanges = ["today", "yesterday", "week", "7", "14", "month", "30", "all", "custom"];
  const range = validRanges.includes(requestedRange) ? requestedRange : "30";
  const days = ["today", "yesterday", "week", "month", "all", "custom"].includes(range) ? 1 : Number(range);
  const requestedPage = Number(url.searchParams.get("page") || "1");
  const requestedPageSize = Number(url.searchParams.get("pageSize") || "50");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = [10, 50, 100, 500].includes(requestedPageSize) ? requestedPageSize : 50;
  const offset = (page - 1) * pageSize;
  const requestedSearchPage = Number(url.searchParams.get("searchPage") || "1");
  const requestedSearchPageSize = Number(url.searchParams.get("searchPageSize") || "25");
  const searchPage = Number.isInteger(requestedSearchPage) && requestedSearchPage > 0 ? requestedSearchPage : 1;
  const searchPageSize = [10, 25, 50, 100].includes(requestedSearchPageSize) ? requestedSearchPageSize : 25;
  const searchOffset = (searchPage - 1) * searchPageSize;
  const requestedPlatformClickPage = Number(url.searchParams.get("platformClickPage") || "1");
  const requestedPlatformClickPageSize = Number(url.searchParams.get("platformClickPageSize") || "25");
  const platformClickPage = Number.isInteger(requestedPlatformClickPage) && requestedPlatformClickPage > 0 ? requestedPlatformClickPage : 1;
  const platformClickPageSize = [10, 25, 50, 100].includes(requestedPlatformClickPageSize) ? requestedPlatformClickPageSize : 25;
  const platformClickOffset = (platformClickPage - 1) * platformClickPageSize;
  const customStart = beijingDateStartUtc(url.searchParams.get("startDate") || "");
  const customEnd = beijingDateStartUtc(url.searchParams.get("endDate") || "");
  const since = range === "today" ? beijingDayStartUtc(0) : range === "yesterday" ? beijingDayStartUtc(1) : range === "week" ? beijingWeekStartUtc() : range === "month" ? (() => { const now = new Date(Date.now() + 8 * 60 * 60 * 1000); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, -8)).toISOString(); })() : range === "all" ? "1970-01-01T00:00:00.000Z" : range === "custom" && customStart ? customStart : beijingDayStartUtc(days - 1);
  const until = range === "yesterday" ? beijingDayStartUtc(0) : range === "custom" && customEnd ? new Date(new Date(customEnd).getTime() + 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString();
  const periodLabel = range === "today" ? "今天" : range === "yesterday" ? "昨天" : range === "week" ? "本周（周一至今）" : range === "14" ? "过去 14 天" : range === "month" ? "本月" : range === "all" ? "所有时间" : range === "custom" ? `${url.searchParams.get("startDate") || ""} 至 ${url.searchParams.get("endDate") || ""}` : `过去 ${days} 天`;
  const isDefaultPageView = page === ANALYTICS_CACHE_PAGE && pageSize === 50 && searchPage === 1 && searchPageSize === 25 && platformClickPage === 1 && platformClickPageSize === 25;
  const analyticsCacheKey = env.ANALYTICS_CACHE && isDefaultPageView ? `analytics:summary:${range}:${since}:${until}` : null;
  if (analyticsCacheKey) {
    try {
      const cached = await env.ANALYTICS_CACHE!.get(analyticsCacheKey);
      if (cached) return response(request, env, JSON.parse(cached));
    } catch { /* KV read error → fall through to D1 */ }
  }
  const [totals, events, products, platforms, spreadsheetPlatforms, platformClicks, platformClickTotal, categories, daily, sources, sourceUsers, media, campaigns, devices, languages, paths, searches, searchTotal, conversions, recentTotal, recent] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total_events, COUNT(DISTINCT anonymous_id) AS unique_visitors, COUNT(DISTINCT session_id) AS unique_sessions, COUNT(DISTINCT CASE WHEN event_name = 'product_detail_view' THEN anonymous_id END) AS detail_visitors, COUNT(DISTINCT CASE WHEN event_name IN ('affiliate_click','outbound_click') THEN anonymous_id END) AS click_visitors FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ?").bind(since, until).first(),
    env.DB.prepare("SELECT event_name AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY event_name ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT product_id AS id, MAX(source_product_id) AS source_product_id, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND product_id IS NOT NULL GROUP BY product_id ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT platform AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND platform IS NOT NULL GROUP BY platform ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT platform AS name, COUNT(*) AS count, COUNT(DISTINCT anonymous_id) AS user_count, SUM(CASE WHEN event_name = 'spreadsheet_platform_select' THEN 1 ELSE 0 END) AS selection_count, SUM(CASE WHEN event_name = 'spreadsheet_platform_auto_select' THEN 1 ELSE 0 END) AS auto_select_count, SUM(CASE WHEN event_name = 'affiliate_click' THEN 1 ELSE 0 END) AS click_count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND path = '/spreadsheet' AND platform IS NOT NULL AND event_name IN ('spreadsheet_platform_select','spreadsheet_platform_auto_select','affiliate_click') GROUP BY platform ORDER BY click_count DESC, selection_count DESC, count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT product_id, MAX(COALESCE(NULLIF(json_extract(properties_json, '$.product_name'), ''), product_id)) AS product_name, MAX(COALESCE(NULLIF(json_extract(properties_json, '$.style_label'), ''), '')) AS style_label, MAX(CAST(json_extract(properties_json, '$.price') AS REAL)) AS price, MAX(COALESCE(NULLIF(json_extract(properties_json, '$.currency'), ''), 'USD')) AS currency, platform, MAX(COALESCE(NULLIF(json_extract(properties_json, '$.product_image'), ''), '')) AS image, COUNT(*) AS click_count, MAX(occurred_at) AS last_clicked_at FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND event_name IN ('affiliate_click','outbound_click') AND product_id IS NOT NULL AND platform IS NOT NULL GROUP BY product_id, platform ORDER BY click_count DESC, last_clicked_at DESC LIMIT ? OFFSET ?").bind(since, until, platformClickPageSize, platformClickOffset).all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM (SELECT product_id, platform FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND event_name IN ('affiliate_click','outbound_click') AND product_id IS NOT NULL AND platform IS NOT NULL GROUP BY product_id, platform)").bind(since, until).first(),
    env.DB.prepare("SELECT category AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT date(occurred_at, '+8 hours') AS date, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY date ORDER BY date ASC").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_source, ''), 'direct') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_source, ''), 'direct') AS name, COUNT(DISTINCT COALESCE(NULLIF(anonymous_id, ''), NULLIF(session_id, ''))) AS user_count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY user_count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_medium, ''), 'none') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_campaign, ''), 'none') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(device, ''), 'unknown') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC LIMIT 20").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(language, ''), 'unknown') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC LIMIT 20").bind(since, until).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(path, ''), '/') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since, until).all(),
    env.DB.prepare(`SELECT query AS name, COUNT(*) AS count, SUM(CASE WHEN event_name = 'search_no_result' THEN 1 ELSE 0 END) AS no_result_count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND event_name IN ('search', 'search_no_result') AND query IS NOT NULL AND query != '' GROUP BY query ORDER BY count DESC, query ASC LIMIT ${searchPageSize} OFFSET ${searchOffset}`).bind(since, until).all(),
    env.DB.prepare("SELECT COUNT(DISTINCT query) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND event_name IN ('search', 'search_no_result') AND query IS NOT NULL AND query != ''").bind(since, until).first(),
    env.DB.prepare("SELECT event_name AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND event_name IN ('product_detail_view','favorite_add','dislike','affiliate_click','outbound_click','request_product_submit','discord_feedback_click') GROUP BY event_name ORDER BY count DESC").bind(since, until).all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ?").bind(since, until).first(),
    env.DB.prepare("SELECT id, event_name, occurred_at, path, product_id, category, platform, device, language, utm_source, utm_campaign, query, list_type, position FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? ORDER BY id DESC LIMIT ? OFFSET ?").bind(since, until, pageSize, offset).all<AnalyticsRow>(),
  ]);
  const payload = {
    days, range, periodLabel, page, pageSize, searchPage, searchPageSize, searchTotal: Number((searchTotal as { count?: number } | null)?.count || 0), platformClickPage, platformClickPageSize, platformClickTotal: Number((platformClickTotal as { count?: number } | null)?.count || 0), recentTotal: Number((recentTotal as { count?: number } | null)?.count || 0),
    totals: totals || { total_events: 0, unique_visitors: 0, unique_sessions: 0, detail_visitors: 0, click_visitors: 0 },
    events: events.results || [], products: products.results || [], platforms: platforms.results || [], spreadsheetPlatforms: spreadsheetPlatforms.results || [], platformClicks: platformClicks.results || [], categories: categories.results || [], daily: daily.results || [],
    sources: sources.results || [], sourceUsers: sourceUsers.results || [], media: media.results || [], campaigns: campaigns.results || [], devices: devices.results || [], languages: languages.results || [], paths: paths.results || [], searches: searches.results || [], conversions: conversions.results || [], recent: recent.results || [],
  };
  if (analyticsCacheKey) {
    try { await env.ANALYTICS_CACHE!.put(analyticsCacheKey, JSON.stringify(payload), { expirationTtl: ANALYTICS_CACHE_TTL }); } catch { /* KV write error → ignore */ }
  }
  return response(request, env, payload);
}

async function getAnalyticsReferrers(request: Request, env: Env, asCsv = false) {
  if (!isAdmin(request, env)) return response(request, env, { error: "没有后台访问权限。" }, 401);
  const url = new URL(request.url);
  const requestedRange = url.searchParams.get("range") || "30";
  const validRanges = ["today", "yesterday", "week", "7", "14", "month", "30", "all", "custom"];
  const range = validRanges.includes(requestedRange) ? requestedRange : "30";
  const days = ["today", "yesterday", "week", "month", "all", "custom"].includes(range) ? 1 : Number(range);
  const customStart = beijingDateStartUtc(url.searchParams.get("startDate") || "");
  const customEnd = beijingDateStartUtc(url.searchParams.get("endDate") || "");
  const since = range === "today" ? beijingDayStartUtc(0) : range === "yesterday" ? beijingDayStartUtc(1) : range === "week" ? beijingWeekStartUtc() : range === "month" ? (() => { const now = new Date(Date.now() + 8 * 60 * 60 * 1000); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, -8)).toISOString(); })() : range === "all" ? "1970-01-01T00:00:00.000Z" : range === "custom" && customStart ? customStart : beijingDayStartUtc(days - 1);
  const until = range === "yesterday" ? beijingDayStartUtc(0) : range === "custom" && customEnd ? new Date(new Date(customEnd).getTime() + 24 * 60 * 60 * 1000).toISOString() : new Date().toISOString();
  const periodLabel = range === "today" ? "今天" : range === "yesterday" ? "昨天" : range === "week" ? "本周（周一至今）" : range === "14" ? "过去 14 天" : range === "month" ? "本月" : range === "all" ? "所有时间" : range === "custom" ? `${url.searchParams.get("startDate") || ""} 至 ${url.searchParams.get("endDate") || ""}` : `过去 ${days} 天`;
  const LIMIT_HOST = 100;
  const LIMIT_FULL = 200;
  const LIMIT_MATRIX = 200;
  const [referrerAgg, matrixAgg, directAgg] = await Promise.all([
    env.DB.prepare("SELECT referrer, COUNT(*) AS event_count, COUNT(DISTINCT anonymous_id) AS visitor_count, COUNT(DISTINCT session_id) AS session_count, MIN(occurred_at) AS first_seen, MAX(occurred_at) AS last_seen FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? GROUP BY referrer ORDER BY event_count DESC LIMIT ?").bind(since, until, LIMIT_FULL).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(path, ''), '/') AS path, referrer, COUNT(*) AS event_count, COUNT(DISTINCT anonymous_id) AS visitor_count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND path IS NOT NULL GROUP BY path, referrer ORDER BY event_count DESC LIMIT ?").bind(since, until, LIMIT_MATRIX).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(path, ''), '/') AS path, COUNT(*) AS event_count, COUNT(DISTINCT anonymous_id) AS visitor_count FROM analytics_events WHERE occurred_at >= ? AND occurred_at < ? AND referrer IS NULL GROUP BY path ORDER BY event_count DESC LIMIT 100").bind(since, until).all(),
  ]);
  const isInternalHost = (hostname: string) => /productsite-8wf\.pages\.dev$/i.test(hostname);
  function parseReferrer(raw: string | null | undefined) {
    if (!raw) return { kind: "direct", host: "", full: "", fullCanonical: "" } as const;
    try {
      const parsed = new URL(raw);
      const isInternal = isInternalHost(parsed.hostname);
      const queryKeys = [...parsed.searchParams.keys()];
      const utmOnly = queryKeys.every((key) => key.startsWith("utm_") || key === "gclid" || key === "ref");
      const canonical = utmOnly ? `${parsed.origin}${parsed.pathname}${parsed.search}` : `${parsed.origin}${parsed.pathname}`;
      const fixed = canonical.length > 300 ? raw.slice(0, 300) : canonical;
      return { kind: isInternal ? "internal" : "external", host: parsed.hostname, full: raw.slice(0, 300), fullCanonical: fixed } as const;
    } catch {
      return { kind: "external", host: "(unparseable)", full: raw.slice(0, 300), fullCanonical: raw.slice(0, 120) } as const;
    }
  }
  // Build host aggregation.
  const hostBuckets = new Map<string, { host: string; kind: "direct" | "internal" | "external"; event_count: number; visitor_count: number; session_count: number; first_seen: string; last_seen: string }>();
  const bumpHost = (host: string, kind: "direct" | "internal" | "external", eventCount: number, visitorCount: number, sessionCount: number, first: string, last: string) => {
    const key = `${kind}:${host}`;
    const existing = hostBuckets.get(key);
    if (existing) {
      existing.event_count += eventCount;
      existing.visitor_count = Math.max(existing.visitor_count, visitorCount); // DISTINCT across hosts isn't additive; keep as max signal
      existing.session_count += sessionCount;
      if (first < existing.first_seen) existing.first_seen = first;
      if (last > existing.last_seen) existing.last_seen = last;
    } else {
      hostBuckets.set(key, { host, kind, event_count: eventCount, visitor_count: visitorCount, session_count: sessionCount, first_seen: first, last_seen: last });
    }
  };
  for (const row of referrerAgg.results) {
    const parsed = parseReferrer((row as { referrer: string | null }).referrer);
    bumpHost(parsed.host || "(direct)", parsed.kind, Number(row.event_count), Number(row.visitor_count), Number(row.session_count), String(row.first_seen), String(row.last_seen));
  }
  for (const row of directAgg.results) {
    const parsed = parseReferrer(null);
    bumpHost("(direct)", "direct", Number(row.event_count), Number(row.visitor_count), 0, String(until), String(since)); // direct rows have no referrer; first/last are period bounds
  }
  const hosts = [...hostBuckets.values()].sort((a, b) => b.event_count - a.event_count).slice(0, LIMIT_HOST);
  // Build full URL aggregation.
  const full = referrerAgg.results.map((row) => {
    const parsed = parseReferrer((row as { referrer: string | null }).referrer);
    return {
      kind: parsed.kind,
      host: parsed.host,
      full: parsed.full,
      full_canonical: parsed.fullCanonical,
      event_count: Number(row.event_count),
      visitor_count: Number(row.visitor_count),
      session_count: Number(row.session_count),
      first_seen: String(row.first_seen),
      last_seen: String(row.last_seen),
    };
  }).sort((a, b) => b.event_count - a.event_count).slice(0, LIMIT_FULL);
  // Build entry-path × referrer-host matrix.
  const matrixRaw = matrixAgg.results.map((row) => {
    const parsed = parseReferrer((row as { referrer: string | null }).referrer);
    return { path: String((row as { path: string }).path), host: parsed.host || "(direct)", kind: parsed.kind, event_count: Number(row.event_count), visitor_count: Number(row.visitor_count) };
  });
  for (const row of directAgg.results) {
    matrixRaw.push({ path: String((row as { path: string }).path), host: "(direct)", kind: "direct", event_count: Number(row.event_count), visitor_count: Number(row.visitor_count) });
  }
  const pathHostBuckets = new Map<string, typeof matrixRaw>();
  for (const row of matrixRaw) {
    const key = row.path;
    if (!pathHostBuckets.has(key)) pathHostBuckets.set(key, []);
    pathHostBuckets.get(key)!.push(row);
  }
  const matrix = [...pathHostBuckets.entries()].map(([path, rows]) => ({ path, entries: rows.sort((a, b) => b.event_count - a.event_count).slice(0, 10) })).sort((a, b) => b.entries.reduce((sum, r) => sum + r.event_count, 0) - a.entries.reduce((sum, r) => sum + r.event_count, 0)).slice(0, LIMIT_MATRIX);
  const summaryTotal = Number(referrerAgg.results.reduce((sum, row) => sum + Number(row.event_count), 0)) + Number(directAgg.results.reduce((sum, row) => sum + Number(row.event_count), 0));
  const externalTotal = hosts.filter((h) => h.kind === "external").reduce((sum, h) => sum + h.event_count, 0);
  const internalTotal = hosts.filter((h) => h.kind === "internal").reduce((sum, h) => sum + h.event_count, 0);
  const directTotal = hosts.filter((h) => h.kind === "direct").reduce((sum, h) => sum + h.event_count, 0);
  const period = { days, range, periodLabel, since, until };
  if (asCsv) {
    const scope = (url.searchParams.get("scope") || "all") as "host" | "full" | "matrix" | "all";
    const parts: string[] = [];
    const appendHosts = () => {
      parts.push("# 来源域名（按事件次数降序）");
      parts.push(["kind", "host", "event_count", "visitor_count", "session_count", "first_seen", "last_seen"].join(","));
      for (const h of hosts) parts.push([h.kind, h.host, h.event_count, h.visitor_count, h.session_count, h.first_seen, h.last_seen].map(csvEscape).join(","));
      parts.push("");
    };
    const appendFull = () => {
      parts.push("# 完整来源 URL");
      parts.push(["kind", "host", "full_url", "canonical_url", "event_count", "visitor_count", "session_count", "first_seen", "last_seen"].join(","));
      for (const f of full) parts.push([f.kind, f.host, f.full, f.full_canonical, f.event_count, f.visitor_count, f.session_count, f.first_seen, f.last_seen].map(csvEscape).join(","));
      parts.push("");
    };
    const appendMatrix = () => {
      parts.push("# 入口页面 × 来源域名");
      parts.push(["entry_path", "kind", "referrer_host", "event_count", "visitor_count"].join(","));
      for (const group of matrix) for (const entry of group.entries) parts.push([group.path, entry.kind, entry.host, entry.event_count, entry.visitor_count].map(csvEscape).join(","));
      parts.push("");
    };
    parts.push(`# ProductSite Analytics Referrers Export — ${periodLabel} (${since.slice(0, 10)} to ${until.slice(0, 10)})`);
    parts.push(`# External events: ${externalTotal}, Internal: ${internalTotal}, Direct: ${directTotal}, Total: ${summaryTotal}`);
    parts.push("");
    if (scope === "host" || scope === "all") appendHosts();
    if (scope === "full" || scope === "all") appendFull();
    if (scope === "matrix" || scope === "all") appendMatrix();
    const filename = `productsite-referrers-${range}-${since.slice(0, 10)}.csv`;
    return new Response(new TextEncoder().encode("\ufeff" + parts.join("\n")), {
      status: 200,
      headers: { ...Object.fromEntries(corsHeaders(request, env)), "content-type": "text/csv; charset=UTF-8", "content-disposition": `attachment; filename="${filename}"` },
    });
  }
  return response(request, env, {
    period,
    totals: { external: externalTotal, internal: internalTotal, direct: directTotal, summary: summaryTotal },
    hosts, full, matrix,
  });
}
function csvEscape(value: unknown) { const text = typeof value === "string" ? value : value == null ? "" : String(value); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function productTemplateResponse(request: Request, env: Env) { return new Response(`${productTemplateHeaders.join(",")}\n`, { status: 200, headers: { ...Object.fromEntries(corsHeaders(request, env)), "content-type": "text/csv; charset=UTF-8", "content-disposition": 'attachment; filename="productsite-product-template.csv"' } }); }
const affiliateTemplates: Record<string, (id: string) => string> = {
  Litbuy: (id) => `https://litbuy.com/product/weidian/${id}?inviteCode=XXGYH4Z80`,
  GTBuy: (id) => `https://gtbuy.com/product/weidian/${id}?inviteCode=XO78PVRZW`,
  Oopbuy: (id) => `https://oopbuy.com/product/weidian/${id}?inviteCode=Y5DH4UF2W`,
  Hipobuy: (id) => `https://hipobuy.com/product/weidian/${id}?inviteCode=P6PP29VX7`,
  Fansbuy: (id) => `https://fansbuy.com/item-micro-${id}.html?promotionCode=R0dfTU9DRzA2VTk`,
  LoveGoBuy: (id) => `https://www.lovegobuy.com/product?shop_type=weidian&id=${id}&invite_code=U577HX`,
  Hoobuy: (id) => `https://hoobuy.com/product/2/${id}?inviteCode=K8l2grxX`,
  UsFans: (id) => `https://www.usfans.com/product/3/${id}?ref=BCSLQC`,
  AllChinaBuy: (id) => `https://www.allchinabuy.com/en/page/buy/?nTag=Home-search&from=search-input&_search=url&position=&url=${encodeURIComponent(`https://weidian.com/item.html?itemID=${id}`)}&partnercode=EEa5go`,
  Mulebuy: (id) => `https://mulebuy.com/product/?shop_type=weidian&id=${id}&ref=200209428`,
  AcBuy: (id) => `https://www.acbuy.com/product?id=${id}&source=WD&u=3FLN4S`,
  Joyagoo: (id) => `https://joyagoo.com/product?id=${id}&platform=WEIDIAN&productUrl=&productPwd=`,
  EastMallBuy: (id) => `https://eastmallbuy.com/web/#/item/index?tp=1688&tid=&searchlang=en&url=${encodeURIComponent(`https://shop1784277725.v.weidian.com/item.html?itemID=${id}`)}&inviter=valeriyachentsov`,
  Okeyhaul: (id) => `https://www.okeyhaul.com/mall/detail?sourceUrl=true&spuid=${id}`,
  PonyBuy: (id) => `https://www.ponybuy.com/products/3/${id}`,
  HubbuyCN: (id) => `https://www.hubbuy.com/product/2/${id}`,
  CSSBuy: (id) => `https://www.cssbuy.com/shop/goodsDetail?type=weidian&id=${id}`,
  AnovaBuy: (id) => `https://anovabuy.com/product/${id}?from=search&ecom=3`,
  MyCNBox: (id) => `https://mycnbox.com/goodsDetail?mallType=weidian&itemId=${id}&sourcePage=SEARCH`,
  iTaoBuy: (id) => `https://www.itaobuy.com/product-detail?url=${encodeURIComponent(`https://shop1784277725.v.weidian.com/item.html?itemID=${id}`)}`,
  Didpop: (id) => `https://www.didpop.com/en/page/buy/?nTag=Home-search&from=search-input&url=${encodeURIComponent(`https://shop1784277725.v.weidian.com/item.html?itemID=${id}`)}`,
  BBDBuy: (id) => `https://www.bbdbuy.com/goods/WEIDIAN/${id}?from=search`,
  CnShopper: (id) => `https://cnshopper.com/product/weidian/${id}`,
  ESGOBuy: (id) => `https://www.esgobuy.com/productDetail?url=${encodeURIComponent(`https://shop1784277725.v.weidian.com/item.html?itemID=${id}`)}`,
  OrientDig: (id) => `https://orientdig.com/product/?shop_type=weidian&id=${id}&ref=100245718`,
  Sugargoo: (id) => `https://www.sugargoo.com/products?productLink=${encodeURIComponent(`https://weidian.com/item.html?itemID=${id}`)}&memberId=3229305473717352480`,
  BBDBuyEU: (id) => `https://www.bbdbuyeu.com/goods/WEIDIAN/${id}?inviteCode=j4zwj7`,
  VigorBuy: (id) => `https://vigorbuy.com/product/2/${id}?inviteCode=jkNlpqAP`,
  Fishgoo: (id) => `https://www.fishgoo.com/#/product?productLink=${encodeURIComponent(`https://weidian.com/item.html?itemID=${id}`)}&memberId=TG2665ux5KieI`,
};
export function extractWeidianId(value: string) {
  if (!validUrl(value)) return "";
  try { const url = new URL(value); const fromQuery = url.searchParams.get("itemID") || url.searchParams.get("id"); if (fromQuery && /^\d{6,20}$/.test(fromQuery)) return fromQuery; const match = `${url.hostname}${url.pathname}`.match(/(?:item-micro-|goods\/WEIDIAN\/|product\/(?:2|3)\/|product\/weidian\/|weidian\/|itemID[=/_-])([0-9]{6,20})/i); return match?.[1] || ""; } catch { return ""; }
}
export function generateAffiliateLinks(sourceUrl: string, existing: Record<string, unknown> = {}) {
  const id = extractWeidianId(sourceUrl); if (!id) return { id: "", links: existing };
  const links: Record<string, string> = { ...Object.fromEntries(Object.entries(affiliateTemplates).map(([name, create]) => [name, create(id)])) };
  for (const [name, value] of Object.entries(existing)) if (typeof value === "string" && value.trim()) links[name] = value;
  return { id, links };
}

export function normalizeProductImportRow(input: unknown) {
  if (!input || typeof input !== "object") return { error: "每一行必须是对象。" } as const;
  const row = input as Record<string, unknown>;
  const id = normalizeText(row.id, 120); const name = normalizeText(row.name, 240); const category = normalizeText(row.category, 80); const price = Number(row.price);
  if (!id || !name || !category || !Number.isFinite(price) || price < 0) return { error: "id、name、category 和非负 price 为必填字段。" } as const;
  const arrayValue = (value: unknown) => Array.isArray(value) ? value.map((item) => normalizeText(item, 300)).filter(Boolean).slice(0, 100) : normalizeText(value, 4000).split(/[|;]/).map((item) => item.trim()).filter(Boolean).slice(0, 100);
  const objectValue = (value: unknown) => { if (!value) return {}; if (typeof value === "object") return value; try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; } };
  const sourceUrl = normalizeText(row.url, 1000); const existingPlatformLinks = objectValue(row.platformLinks); const generated = generateAffiliateLinks(sourceUrl, existingPlatformLinks);
  const payload = { id, sourceProductId: normalizeText(row.sourceProductId, 120) || generated.id, name, catalogName: normalizeText(row.catalogName, 240) || name, category, subCategory: normalizeText(row.subCategory, 120), brand: normalizeText(row.brand, 120), price, referencePrice: row.referencePrice === "" || row.referencePrice == null ? null : Number(row.referencePrice), currency: normalizeText(row.currency, 12) || "USD", description: normalizeText(row.description, 2000), sizes: arrayValue(row.sizes), colors: arrayValue(row.colors), stock: normalizeText(row.stock, 80), shop: normalizeText(row.shop, 160), shopUrl: normalizeText(row.shopUrl, 500), url: sourceUrl, images: arrayValue(row.images), tags: arrayValue(row.tags), collectedAt: normalizeText(row.collectedAt, 80) || new Date().toISOString(), reviewStatus: normalizeText(row.reviewStatus, 20) || "unreviewed", reviewNote: normalizeText(row.reviewNote, 500), platformLinks: generated.links };
  if (!validUrl(payload.shopUrl) || !validUrl(payload.url) || payload.images.some((image) => !validUrl(image))) return { error: "商品链接、店铺链接和图片链接必须是 HTTP/HTTPS。" } as const;
  return { value: payload } as const;
}
async function adminProductImport(request: Request, env: Env) {
  if (!isAdmin(request, env)) return response(request, env, { error: "没有后台访问权限。" }, 401);
  const rawBody = await request.text(); if (new TextEncoder().encode(rawBody).byteLength > MAX_PRODUCT_IMPORT_BODY_BYTES) return response(request, env, { error: "上传文件过大。" }, 413);
  let body: unknown; try { body = JSON.parse(rawBody); } catch { return response(request, env, { error: "上传数据格式不正确。" }, 400); }
  const rows = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).rows) ? (body as Record<string, unknown>).rows : [];
  if (!rows.length || rows.length > MAX_PRODUCT_IMPORT_ROWS) return response(request, env, { error: `每次必须上传 1-${MAX_PRODUCT_IMPORT_ROWS} 行。` }, 400);
  const normalized = rows.map(normalizeProductImportRow); const invalid = normalized.map((item, index) => "error" in item ? { row: index + 2, error: item.error } : null).filter(Boolean);
  const valid = normalized.filter((item): item is { value: Record<string, unknown> } => "value" in item).map((item) => item.value);
  const commit = Boolean((body as Record<string, unknown>).commit);
  if (invalid.length || !commit) return response(request, env, { preview: true, total: rows.length, valid: valid.length, invalid, sample: valid.slice(0, 20) });
  const statements = valid.map((item) => env.DB.prepare("INSERT INTO product_overrides (product_id, source_product_id, payload_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(product_id) DO UPDATE SET source_product_id=excluded.source_product_id, payload_json=excluded.payload_json, updated_at=CURRENT_TIMESTAMP").bind(item.id, item.sourceProductId || null, JSON.stringify(item)));
  await env.DB.batch(statements);
  if (env.OVERRIDES_CACHE) {
    try { await env.OVERRIDES_CACHE.delete(OVERRIDES_CACHE_KEY); } catch { /* KV delete error → ignore */ }
  }
  return response(request, env, { success: true, imported: statements.length }, 201);
}
async function getProductOverrides(request: Request, env: Env) {
  if (env.OVERRIDES_CACHE) {
    try {
      const cached = await env.OVERRIDES_CACHE.get(OVERRIDES_CACHE_KEY);
      if (cached) return response(request, env, JSON.parse(cached));
    } catch { /* KV read error → fall through to D1 */ }
  }
  const rows = await env.DB.prepare("SELECT payload_json FROM product_overrides ORDER BY product_id").all<{ payload_json: string }>();
  const items = (rows.results || []).flatMap((row) => { try { const value = JSON.parse(row.payload_json); return value && typeof value === "object" ? [value] : []; } catch { return []; } });
  const payload = { items };
  if (env.OVERRIDES_CACHE) {
    try { await env.OVERRIDES_CACHE.put(OVERRIDES_CACHE_KEY, JSON.stringify(payload), { expirationTtl: OVERRIDES_CACHE_TTL }); } catch { /* KV write error → ignore */ }
  }
  return response(request, env, payload);
}

async function createRequest(request: Request, env: Env) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return response(request, env, { error: "The request is too large." }, 413);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return response(request, env, { error: "Unsupported request format." }, 415);
  if (isRateLimited(request)) return response(request, env, { error: "Too many requests. Please wait a minute and try again." }, 429);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) return response(request, env, { error: "The request is too large." }, 413);
  let input: Record<string, unknown> | null = null;
  try {
    input = JSON.parse(rawBody || "null") as Record<string, unknown> | null;
  } catch {
    return response(request, env, { error: "Invalid request body." }, 400);
  }
  if (normalizeText(input?.website, 200)) return response(request, env, { error: "Unable to process this request." }, 400);
  const name = normalizeText(input?.name, 80);
  const contact = normalizeText(input?.contact, 160);
  const productUrl = normalizeText(input?.productUrl, 500);
  const imageUrl = normalizeText(input?.imageUrl, 500);
  const description = normalizeText(input?.description, 2000);
  const notes = normalizeText(input?.notes, 1000);
  if (!name || !description) return response(request, env, { error: "请填写姓名和产品描述。" }, 400);
  if (!validUrl(productUrl) || !validUrl(imageUrl)) return response(request, env, { error: "商品链接或图片链接格式不正确。" }, 400);
  const requestCode = makeRequestCode();
  const metadata = requestMetadata(request);
  await env.DB.prepare(`INSERT INTO product_requests (request_code, name, contact, product_url, image_url, description, notes, ip_address, country, region, city, device_type, browser, operating_system, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(requestCode, name, contact || null, productUrl || null, imageUrl || null, description, notes || null, metadata.ipAddress || null, metadata.country, metadata.region, metadata.city, metadata.deviceType, metadata.browser, metadata.operatingSystem, metadata.userAgent)
    .run();
  return response(request, env, { requestCode, status: "Received" }, 201);
}

async function getPublicRequest(request: Request, env: Env, code: string) {
  const row = await env.DB.prepare("SELECT * FROM product_requests WHERE request_code = ? LIMIT 1").bind(code).first<RequestRow>();
  if (!row) return response(request, env, { error: "找不到这个申请编号。" }, 404);
  return response(request, env, publicRow(row));
}

async function listAdminRequests(request: Request, env: Env) {
  if (!isAdmin(request, env)) return response(request, env, { error: "没有后台访问权限。" }, 401);
  const rows = await env.DB.prepare("SELECT * FROM product_requests ORDER BY datetime(created_at) DESC LIMIT 200").all<RequestRow>();
  return response(request, env, { items: (rows.results || []).map(adminRow) });
}

async function updateAdminRequest(request: Request, env: Env, id: string) {
  if (!isAdmin(request, env)) return response(request, env, { error: "没有后台访问权限。" }, 401);
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return response(request, env, { error: "申请编号格式不正确。" }, 400);
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = normalizeText(input?.status, 20);
  const reply = normalizeText(input?.adminReply, 3000);
  if (!statuses.has(status)) return response(request, env, { error: "状态不正确。" }, 400);
  const result = await env.DB.prepare("UPDATE product_requests SET status = ?, admin_reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, reply || null, numericId).run();
  if (!result.success || !result.meta.changes) return response(request, env, { error: "申请记录不存在。" }, 404);
  return response(request, env, { success: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/api/requests") return await createRequest(request, env);
      if (request.method === "POST" && url.pathname === "/api/analytics/events") return await ingestAnalytics(request, env);
      if (request.method === "GET" && url.pathname === "/api/admin/products/template") return productTemplateResponse(request, env);
      if (request.method === "POST" && url.pathname === "/api/admin/products/import") return await adminProductImport(request, env);
      if (request.method === "GET" && url.pathname === "/api/products/overrides") return await getProductOverrides(request, env);
      const publicMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
      if (request.method === "GET" && publicMatch) return await getPublicRequest(request, env, decodeURIComponent(publicMatch[1]));
      if (request.method === "GET" && url.pathname === "/api/admin/requests") return await listAdminRequests(request, env);
      if (request.method === "GET" && url.pathname === "/api/admin/analytics/summary") return await getAnalyticsSummary(request, env);
      if (request.method === "GET" && url.pathname === "/api/admin/analytics/referrers") return await getAnalyticsReferrers(request, env, false);
      if (request.method === "GET" && url.pathname === "/api/admin/analytics/referrers.csv") return await getAnalyticsReferrers(request, env, true);
      const adminMatch = url.pathname.match(/^\/api\/admin\/requests\/(\d+)$/);
      if (request.method === "PATCH" && adminMatch) return await updateAdminRequest(request, env, adminMatch[1]);
      return response(request, env, { error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker request failed", error);
      return response(request, env, { error: "服务暂时不可用，请稍后重试。" }, 500);
    }
  },
};
