import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import { Link } from "wouter";

type Row = { name?: string | null; id?: string | null; count: number };
type Summary = {
  days: number;
  totals: { total_events: number; unique_visitors: number; unique_sessions: number };
  events: Row[];
  products: Row[];
  platforms: Row[];
  categories: Row[];
  daily: Row[];
  recent: Array<{ id: number; event_name: string; occurred_at: string; path: string | null; product_id: string | null; category: string | null; platform: string | null; device: string | null; utm_source: string | null; utm_campaign: string | null }>;
};

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
const KEY_NAME = "productsite-admin-key";

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function Ranking({ title, rows, label = "name" }: { title: string; rows: Row[]; label?: "name" | "id" }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <section className="analytics-section"><div className="analytics-section-title"><h2>{title}</h2><span>Top 10</span></div>{rows.length ? <div className="analytics-ranking">{rows.slice(0, 10).map((row, index) => <div className="analytics-rank" key={`${row[label] || "unknown"}-${index}`}><div className="analytics-rank-label"><strong>{index + 1}. {row[label] || "Unknown"}</strong><span>{row.count}</span></div><div className="analytics-bar"><i style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} /></div></div>)}</div> : <p className="analytics-muted">No events in this period.</p>}</section>;
}

export default function AdminAnalytics() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_NAME) || "");
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!workerUrl) { setMessage("Worker URL is not configured."); return; }
    if (!key.trim()) { setMessage("Enter the Worker admin key."); return; }
    setLoading(true); setMessage(""); localStorage.setItem(KEY_NAME, key.trim());
    try {
      const response = await fetch(`${workerUrl}/api/admin/analytics/summary?days=${days}`, { headers: { "x-admin-api-key": key.trim() } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to load analytics.");
      setSummary(payload as Summary);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load analytics."); } finally { setLoading(false); }
  };

  useEffect(() => { if (key && workerUrl) void load(); }, []);
  const peak = useMemo(() => Math.max(1, ...(summary?.daily || []).map((row) => row.count)), [summary]);

  return <div className="analytics-page"><header className="analytics-header"><Link href="/" className="admin-back"><ArrowLeft size={15} /> Back to catalog</Link><div><span className="request-eyebrow">PRODUCTSITE ANALYTICS</span><h1>Behavioral catalog signals</h1><p>Anonymous first-party events collected by your Cloudflare Worker and stored in D1.</p></div></header><main className="analytics-main"><section className="analytics-control"><label>Worker admin key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="x-admin-api-key" /></label><label>Period<select value={days} onChange={(event) => setDays(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><button onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "analytics-spin" : ""} /> {loading ? "Loading…" : "Load analytics"}</button></section>{message && <p className="analytics-message">{message}</p>}{summary && <><section className="analytics-kpis"><div><span>Total events</span><strong>{summary.totals.total_events.toLocaleString()}</strong><small>Last {summary.days} days</small></div><div><span>Unique visitors</span><strong>{summary.totals.unique_visitors.toLocaleString()}</strong><small>Anonymous IDs</small></div><div><span>Unique sessions</span><strong>{summary.totals.unique_sessions.toLocaleString()}</strong><small>Session IDs</small></div></section><section className="analytics-section analytics-daily"><div className="analytics-section-title"><h2>Event volume</h2><span><BarChart3 size={14} /> Daily</span></div><div className="analytics-daily-chart">{summary.daily.length ? summary.daily.map((row) => <div className="analytics-day" key={String(row.name)}><div className="analytics-day-bar" style={{ height: `${Math.max(4, (row.count / peak) * 100)}%` }} title={`${row.name}: ${row.count}`} /><small>{String(row.name).slice(5)}</small></div>) : <p className="analytics-muted">No daily data yet.</p>}</div></section><div className="analytics-grid"><Ranking title="Events" rows={summary.events} /><Ranking title="Products" rows={summary.products} label="id" /><Ranking title="Platforms" rows={summary.platforms} /><Ranking title="Categories" rows={summary.categories} /></div><section className="analytics-section"><div className="analytics-section-title"><h2>Recent events</h2><span>{summary.recent.length} records</span></div><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Event</th><th>Time</th><th>Product</th><th>Category</th><th>Platform</th><th>Device</th><th>Source</th></tr></thead><tbody>{summary.recent.map((row) => <tr key={row.id}><td><strong>{row.event_name}</strong><small>{row.path || "—"}</small></td><td>{formatDate(row.occurred_at)}</td><td>{row.product_id || "—"}</td><td>{row.category || "—"}</td><td>{row.platform || "—"}</td><td>{row.device || "—"}</td><td>{row.utm_source || row.utm_campaign || "direct"}</td></tr>)}</tbody></table></div></section></>}</main></div>;
}
