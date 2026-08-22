import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, Send } from "lucide-react";
import { Link } from "wouter";

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
type RequestRow = {
  id: number; requestCode: string; name: string; contact: string | null; productUrl: string | null; imageUrl: string | null;
  description: string; notes: string | null; status: string; adminReply: string | null;
  ipAddress: string | null; country: string | null; region: string | null; city: string | null;
  deviceType: string | null; browser: string | null; operatingSystem: string | null; userAgent: string | null;
  createdAt: string; updatedAt: string;
};
const statusOptions = ["Received", "Reviewing", "Accepted", "Closed"];
function valueOrDash(value: string | null | undefined) { return value?.trim() || "—"; }
function Field({ label, value }: { label: string; value: string | null | undefined }) { return <div className="admin-meta-field"><span>{label}</span><strong>{valueOrDash(value)}</strong></div>; }

export default function AdminRequests() {
  const [key, setKey] = useState(() => window.localStorage.getItem("productsite-admin-key") || "");
  const [items, setItems] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("Received");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!workerUrl || !key) { setMessage("Configure the Worker URL and enter the admin key first."); return; }
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`${workerUrl}/api/admin/requests`, { headers: { "x-admin-api-key": key } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load requests.");
      setItems(payload.items || []);
      window.localStorage.setItem("productsite-admin-key", key);
      setSelected((current) => current ? (payload.items || []).find((item: RequestRow) => item.id === current.id) || null : null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load requests."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (key && workerUrl) void load(); }, []);
  const choose = (item: RequestRow) => { setSelected(item); setReply(item.adminReply || ""); setStatus(item.status); };
  const save = async () => {
    if (!selected || !workerUrl || !key) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`${workerUrl}/api/admin/requests/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-admin-api-key": key }, body: JSON.stringify({ status, adminReply: reply }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save the reply.");
      setMessage("Reply and status saved."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the reply."); }
    finally { setLoading(false); }
  };

  return <div className="admin-request-page"><header className="admin-request-header"><Link href="/" className="admin-back"><ArrowLeft size={15} /> Back to catalog</Link><div><span className="request-eyebrow">CATALOG ADMIN</span><h1>Product Request Admin</h1></div><button className="admin-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</button></header><main className="admin-request-layout"><section className="admin-request-list"><div className="admin-panel-head"><strong>Requests</strong><span>{items.length} requests</span></div>{!workerUrl && <p className="admin-empty">`VITE_CLOUDFLARE_WORKER_URL` is not configured.</p>}{workerUrl && !items.length && <p className="admin-empty">No requests yet. Enter the admin key and click Load requests.</p>}{items.map((item) => <button key={item.id} className={`admin-request-item ${selected?.id === item.id ? "is-selected" : ""}`} onClick={() => choose(item)}><span><strong>{item.requestCode}</strong><small>{item.name} · {item.createdAt}</small></span><em>{item.status}</em></button>)}</section><section className="admin-request-detail"><div className="admin-panel-head"><strong>Admin access</strong><span>Admin only</span></div><label className="admin-field">Worker admin key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="x-admin-api-key" /></label><button className="admin-load" onClick={() => void load()} disabled={loading}>Load requests</button>{selected ? <div className="admin-editor"><div className="admin-detail-heading"><div><span className="request-eyebrow">REQUEST DETAIL</span><h2>{selected.requestCode}</h2></div><em>{selected.status}</em></div><div className="admin-detail-section"><h3>Submitted details</h3><div className="admin-meta-grid"><Field label="Name / nickname" value={selected.name} /><Field label="Contact" value={selected.contact} /><Field label="Submitted" value={selected.createdAt} /><Field label="Last updated" value={selected.updatedAt} /></div><div className="admin-copy-field"><span>Product description</span><p>{valueOrDash(selected.description)}</p></div><div className="admin-copy-field"><span>Additional notes</span><p>{valueOrDash(selected.notes)}</p></div><div className="admin-link-list">{selected.productUrl && <a href={selected.productUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View product link</a>}{selected.imageUrl && <a href={selected.imageUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View image link</a>}</div></div><div className="admin-detail-section admin-visitor-section"><h3>Submission metadata</h3><p className="admin-privacy-note">Collected server-side by Cloudflare Worker. Admin only; IP is masked.</p><div className="admin-meta-grid"><Field label="Masked IP" value={selected.ipAddress} /><Field label="Country / region" value={[selected.country, selected.region, selected.city].filter(Boolean).join(" · ")} /><Field label="Device" value={selected.deviceType} /><Field label="Browser" value={selected.browser} /><Field label="Operating system" value={selected.operatingSystem} /><Field label="User-Agent summary" value={selected.userAgent} /></div></div><div className="admin-detail-section"><h3>Status and reply</h3><label className="admin-field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label className="admin-field">Reply<textarea rows={7} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply for the user" /></label><button className="admin-save" onClick={() => void save()} disabled={loading}><Send size={14} /> Save reply</button></div></div> : <p className="admin-empty">Select a request to view submitted details, metadata, and reply.</p>}{message && <p className="admin-message">{message}</p>}</section></main></div>;
}
