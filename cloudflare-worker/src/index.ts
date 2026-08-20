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
  created_at: string;
  updated_at: string;
};

const statuses = new Set(["Received", "Reviewing", "Accepted", "Closed"]);
const jsonHeaders = { "content-type": "application/json; charset=UTF-8" };

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" ? env.ALLOWED_ORIGIN : origin || "*";
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
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

function isAdmin(request: Request, env: Env) {
  const key = request.headers.get("x-admin-api-key");
  return Boolean(env.ADMIN_API_KEY && key && key === env.ADMIN_API_KEY);
}

async function createRequest(request: Request, env: Env) {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = normalizeText(input?.name, 80);
  const contact = normalizeText(input?.contact, 160);
  const productUrl = normalizeText(input?.productUrl, 500);
  const imageUrl = normalizeText(input?.imageUrl, 500);
  const description = normalizeText(input?.description, 2000);
  const notes = normalizeText(input?.notes, 1000);
  if (!name || !description) return response(request, env, { error: "请填写姓名和产品描述。" }, 400);
  if (!validUrl(productUrl) || !validUrl(imageUrl)) return response(request, env, { error: "商品链接或图片链接格式不正确。" }, 400);
  const requestCode = makeRequestCode();
  await env.DB.prepare(`INSERT INTO product_requests (request_code, name, contact, product_url, image_url, description, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(requestCode, name, contact || null, productUrl || null, imageUrl || null, description, notes || null)
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
  return response(request, env, { items: rows.results || [] });
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
      const publicMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
      if (request.method === "GET" && publicMatch) return await getPublicRequest(request, env, decodeURIComponent(publicMatch[1]));
      if (request.method === "GET" && url.pathname === "/api/admin/requests") return await listAdminRequests(request, env);
      const adminMatch = url.pathname.match(/^\/api\/admin\/requests\/(\d+)$/);
      if (request.method === "PATCH" && adminMatch) return await updateAdminRequest(request, env, adminMatch[1]);
      return response(request, env, { error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker request failed", error);
      return response(request, env, { error: "服务暂时不可用，请稍后重试。" }, 500);
    }
  },
};
