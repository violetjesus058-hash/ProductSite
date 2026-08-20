import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, Send } from "lucide-react";
import { Link } from "wouter";

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
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
const statusOptions = ["Received", "Reviewing", "Accepted", "Closed"];

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || "—";
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="admin-meta-field"><span>{label}</span><strong>{valueOrDash(value)}</strong></div>;
}

export default function AdminRequests() {
  const [key, setKey] = useState(() => window.localStorage.getItem("productsite-admin-key") || "");
  const [items, setItems] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("Received");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!workerUrl || !key) { setMessage("请先配置 Worker 地址并输入管理员密钥。"); return; }
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`${workerUrl}/api/admin/requests`, { headers: { "x-admin-api-key": key } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "读取申请失败。");
      setItems(payload.items || []);
      window.localStorage.setItem("productsite-admin-key", key);
      setSelected((current) => current ? (payload.items || []).find((item: RequestRow) => item.id === current.id) || null : null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "读取申请失败。"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (key && workerUrl) void load(); }, []);

  const choose = (item: RequestRow) => { setSelected(item); setReply(item.admin_reply || ""); setStatus(item.status); };
  const save = async () => {
    if (!selected || !workerUrl || !key) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`${workerUrl}/api/admin/requests/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-admin-api-key": key }, body: JSON.stringify({ status, adminReply: reply }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "保存回复失败。");
      setMessage("回复和状态已保存。");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存回复失败。"); }
    finally { setLoading(false); }
  };

  return <div className="admin-request-page"><header className="admin-request-header"><Link href="/" className="admin-back"><ArrowLeft size={15} /> 返回目录</Link><div><span className="request-eyebrow">CATALOG ADMIN</span><h1>上新申请管理</h1></div><button className="admin-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> 刷新</button></header><main className="admin-request-layout"><section className="admin-request-list"><div className="admin-panel-head"><strong>申请记录</strong><span>{items.length} 条</span></div>{!workerUrl && <p className="admin-empty">尚未配置 `VITE_CLOUDFLARE_WORKER_URL`。</p>}{workerUrl && !items.length && <p className="admin-empty">暂无申请记录。输入密钥后点击刷新。</p>}{items.map((item) => <button key={item.id} className={`admin-request-item ${selected?.id === item.id ? "is-selected" : ""}`} onClick={() => choose(item)}><span><strong>{item.request_code}</strong><small>{item.name} · {item.created_at}</small></span><em>{item.status}</em></button>)}</section><section className="admin-request-detail"><div className="admin-panel-head"><strong>管理权限</strong><span>仅管理员可见</span></div><label className="admin-field">Worker 管理密钥<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="x-admin-api-key" /></label><button className="admin-load" onClick={() => void load()} disabled={loading}>读取申请</button>{selected ? <div className="admin-editor"><div className="admin-detail-heading"><div><span className="request-eyebrow">REQUEST DETAIL</span><h2>{selected.request_code}</h2></div><em>{selected.status}</em></div><div className="admin-detail-section"><h3>用户提交资料</h3><div className="admin-meta-grid"><Field label="姓名 / 昵称" value={selected.name} /><Field label="联系方式" value={selected.contact} /><Field label="提交时间" value={selected.created_at} /><Field label="最后更新" value={selected.updated_at} /></div><div className="admin-copy-field"><span>产品描述</span><p>{valueOrDash(selected.description)}</p></div><div className="admin-copy-field"><span>补充说明</span><p>{valueOrDash(selected.notes)}</p></div><div className="admin-link-list">{selected.product_url && <a href={selected.product_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 查看商品链接</a>}{selected.image_url && <a href={selected.image_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 查看图片链接</a>}</div></div><div className="admin-detail-section admin-visitor-section"><h3>提交访问元数据</h3><p className="admin-privacy-note">以下信息由 Cloudflare Worker 服务端采集，仅管理员可见；IP 已做脱敏处理。</p><div className="admin-meta-grid"><Field label="IP（脱敏）" value={selected.ip_address} /><Field label="国家 / 地区" value={[selected.country, selected.region, selected.city].filter(Boolean).join(" · ")} /><Field label="设备类型" value={selected.device_type} /><Field label="浏览器" value={selected.browser} /><Field label="操作系统" value={selected.operating_system} /><Field label="User-Agent 摘要" value={selected.user_agent} /></div></div><div className="admin-detail-section"><h3>处理与回复</h3><label className="admin-field">处理状态<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="admin-field">回复内容<textarea rows={7} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="输入给用户的回复" /></label><button className="admin-save" onClick={() => void save()} disabled={loading}><Send size={14} /> 保存回复</button></div></div> : <p className="admin-empty">选择左侧申请记录后，可以查看完整资料、访问元数据并回复。</p>}{message && <p className="admin-message">{message}</p>}</section></main></div>;
}
