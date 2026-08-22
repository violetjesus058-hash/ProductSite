export interface Env {
  DB: D1Database;
  ADMIN_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

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

function publicRow(row: RequestRow) {
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

function adminRow(row: RequestRow) {
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
      query: analyticsText(input.query, 160),
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

async function getAnalyticsSummary(request: Request, env: Env) {
  if (!isAdmin(request, env)) return response(request, env, { error: "没有后台访问权限。" }, 401);
  const url = new URL(request.url);
  const requestedRange = url.searchParams.get("range") || "30";
  const range = ["today", "yesterday", "7", "30"].includes(requestedRange) ? requestedRange : "30";
  const days = range === "today" || range === "yesterday" ? 1 : Number(range);
  const periodLabel = range === "today" ? "今天" : range === "yesterday" ? "昨天" : `最近 ${days} 天`;
  const since = range === "today" ? beijingDayStartUtc(0) : range === "yesterday" ? beijingDayStartUtc(1) : beijingDayStartUtc(days - 1);
  const [totals, events, products, platforms, categories, daily, sources, media, campaigns, devices, languages, paths, searches, conversions, recent] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total_events, COUNT(DISTINCT anonymous_id) AS unique_visitors, COUNT(DISTINCT session_id) AS unique_sessions, COUNT(DISTINCT CASE WHEN event_name = 'product_detail_view' THEN anonymous_id END) AS detail_visitors, COUNT(DISTINCT CASE WHEN event_name IN ('affiliate_click','outbound_click') THEN anonymous_id END) AS click_visitors FROM analytics_events WHERE occurred_at >= ?").bind(since).first(),
    env.DB.prepare("SELECT event_name AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY event_name ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT product_id AS id, MAX(source_product_id) AS source_product_id, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND product_id IS NOT NULL GROUP BY product_id ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT platform AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND platform IS NOT NULL GROUP BY platform ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT category AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT date(occurred_at, '+8 hours') AS date, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY date ORDER BY date ASC").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_source, ''), 'direct') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_medium, ''), 'none') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(utm_campaign, ''), 'none') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(device, ''), 'unknown') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY name ORDER BY count DESC LIMIT 20").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(language, ''), 'unknown') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY name ORDER BY count DESC LIMIT 20").bind(since).all(),
    env.DB.prepare("SELECT COALESCE(NULLIF(path, ''), '/') AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? GROUP BY name ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT query AS name, COUNT(*) AS count, SUM(CASE WHEN event_name = 'search_no_result' THEN 1 ELSE 0 END) AS no_result_count FROM analytics_events WHERE occurred_at >= ? AND query IS NOT NULL AND query != '' GROUP BY query ORDER BY count DESC LIMIT 30").bind(since).all(),
    env.DB.prepare("SELECT event_name AS name, COUNT(*) AS count FROM analytics_events WHERE occurred_at >= ? AND event_name IN ('product_detail_view','favorite_add','dislike','affiliate_click','outbound_click','request_product_submit','discord_feedback_click') GROUP BY event_name ORDER BY count DESC").bind(since).all(),
    env.DB.prepare("SELECT id, event_name, occurred_at, path, product_id, category, platform, device, language, utm_source, utm_campaign, query, list_type, position FROM analytics_events WHERE occurred_at >= ? ORDER BY id DESC LIMIT 150").bind(since).all<AnalyticsRow>(),
  ]);
  return response(request, env, {
    days, range, periodLabel,
    totals: totals || { total_events: 0, unique_visitors: 0, unique_sessions: 0, detail_visitors: 0, click_visitors: 0 },
    events: events.results || [], products: products.results || [], platforms: platforms.results || [], categories: categories.results || [], daily: daily.results || [],
    sources: sources.results || [], media: media.results || [], campaigns: campaigns.results || [], devices: devices.results || [], languages: languages.results || [], paths: paths.results || [], searches: searches.results || [], conversions: conversions.results || [], recent: recent.results || [],
  });
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
      const publicMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
      if (request.method === "GET" && publicMatch) return await getPublicRequest(request, env, decodeURIComponent(publicMatch[1]));
      if (request.method === "GET" && url.pathname === "/api/admin/requests") return await listAdminRequests(request, env);
      if (request.method === "GET" && url.pathname === "/api/admin/analytics/summary") return await getAnalyticsSummary(request, env);
      const adminMatch = url.pathname.match(/^\/api\/admin\/requests\/(\d+)$/);
      if (request.method === "PATCH" && adminMatch) return await updateAdminRequest(request, env, adminMatch[1]);
      return response(request, env, { error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker request failed", error);
      return response(request, env, { error: "服务暂时不可用，请稍后重试。" }, 500);
    }
  },
};
