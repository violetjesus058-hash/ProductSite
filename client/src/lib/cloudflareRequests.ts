export type ProductRequestInput = {
  name: string;
  contact: string;
  productUrl: string;
  imageUrl: string;
  description: string;
  notes: string;
  website?: string;
};

export type ProductRequestResult = {
  requestCode: string;
  status: string;
};

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");

export function isCloudflareWorkerConfigured() {
  return Boolean(workerUrl);
}

export async function submitProductRequest(input: ProductRequestInput): Promise<ProductRequestResult> {
  if (!workerUrl) throw new Error("申请服务尚未连接，请先完成 Cloudflare Worker 配置。");
  const response = await fetch(`${workerUrl}/api/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "提交失败，请稍后重试。");
  return payload as ProductRequestResult;
}

export async function getProductRequest(requestCode: string) {
  if (!workerUrl) throw new Error("申请服务尚未连接，请先完成 Cloudflare Worker 配置。");
  const response = await fetch(`${workerUrl}/api/requests/${encodeURIComponent(requestCode)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "查询失败，请稍后重试。");
  return payload;
}
