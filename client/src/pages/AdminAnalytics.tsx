import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Link } from "wouter";

type Row = { name?: string | null; id?: string | null; count: number; no_result_count?: number };
type Summary = {
  days: number;
  range: string;
  periodLabel: string;
  totals: { total_events: number; unique_visitors: number; unique_sessions: number; detail_visitors?: number; click_visitors?: number };
  events: Row[]; products: Row[]; platforms: Row[]; categories: Row[]; daily: Array<{ date?: string; name?: string; count: number }>;
  sources: Row[]; media: Row[]; campaigns: Row[]; devices: Row[]; languages: Row[]; paths: Row[]; searches: Row[]; conversions: Row[];
  recent: Array<{ id: number; event_name: string; occurred_at: string; path: string | null; product_id: string | null; category: string | null; platform: string | null; device: string | null; language: string | null; utm_source: string | null; utm_campaign: string | null; query: string | null; list_type: string | null; position: number | null }>;
};

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
const KEY_NAME = "productsite-admin-key";
const eventNames: Record<string, string> = { session_start: "会话开始", category_view: "查看分类", product_list_view: "查看商品列表", product_impression: "商品曝光", product_click: "点击商品", product_preview: "商品预览", product_detail_view: "商品详情", search: "搜索", search_no_result: "无结果搜索", sort_use: "使用排序", affiliate_click: "平台入口点击", outbound_click: "外部链接点击", favorite_add: "加入收藏", favorite_remove: "取消收藏", dislike: "不喜欢", request_product_open: "打开申请表单", request_product_submit: "提交申请", discord_feedback_click: "Discord 反馈" };
const label = (value?: string | null) => value ? (eventNames[value] || value) : "未标注";
const number = (value: unknown) => Number(value || 0).toLocaleString();
function formatDate(value: string) { return new Date(value).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" }); }

function Ranking({ title, rows, labelKey = "name", empty = "当前周期暂无数据" }: { title: string; rows: Row[]; labelKey?: "name" | "id"; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));
  return <section className="analytics-section"><div className="analytics-section-title"><h2>{title}</h2><span>前 10 名</span></div>{rows.length ? <div className="analytics-ranking">{rows.slice(0, 10).map((row, index) => <div className="analytics-rank" key={`${row[labelKey] || "unknown"}-${index}`}><div className="analytics-rank-label"><strong>{index + 1}. {label(String(row[labelKey] || "未标注"))}</strong><span>{number(row.count)}</span></div><div className="analytics-bar"><i style={{ width: `${Math.max(4, (Number(row.count || 0) / max) * 100)}%` }} /></div></div>)}</div> : <p className="analytics-muted">{empty}</p>}</section>;
}

export default function AdminAnalytics() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_NAME) || "");
  const [showKey, setShowKey] = useState(false);
  const [days, setDays] = useState("30");
  const periodLabels: Record<string, string> = { today: "今天", yesterday: "昨天", "7": "最近 7 天", "30": "最近 30 天" };
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!workerUrl) { setMessage("未配置 Worker 地址，请检查网站环境变量。"); return; }
    if (!key.trim()) { setMessage("请输入 Worker 管理员密钥。"); return; }
    setLoading(true); setMessage(""); localStorage.setItem(KEY_NAME, key.trim());
    try {
      const response = await fetch(`${workerUrl}/api/admin/analytics/summary?range=${encodeURIComponent(days)}`, { headers: { "x-admin-api-key": key.trim() } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error("管理员密钥不正确，请确认 Worker 中的 ADMIN_API_KEY 已更新。");
        if (response.status === 404) throw new Error("Worker 尚未部署分析接口，请先重新部署 Worker。");
        if (response.status >= 500) throw new Error(payload.error || "Worker 或 D1 暂不可用，请确认已执行 analytics_events 数据库迁移。");
        throw new Error(payload.error || "分析数据加载失败。");
      }
      setSummary(payload as Summary);
    } catch (error) { setMessage(error instanceof TypeError ? "无法连接 Worker，请检查地址、CORS 和网络。" : error instanceof Error ? error.message : "分析数据加载失败。"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (key && workerUrl) void load(); }, []);
  const peak = useMemo(() => Math.max(1, ...(summary?.daily || []).map((row) => Number(row.count || 0))), [summary]);
  const clickRate = summary ? ((Number(summary.totals.click_visitors || 0) / Math.max(1, Number(summary.totals.detail_visitors || 0))) * 100).toFixed(1) : "0.0";
  return <div className="analytics-page"><header className="analytics-header"><Link href="/" className="admin-back"><ArrowLeft size={15} /> 返回商品目录</Link><div><span className="request-eyebrow">PRODUCTSITE 私有分析</span><h1>用户行为与商品表现</h1><p>匿名第一方事件数据，存储于 Cloudflare Worker 与 D1；不显示姓名、邮箱或原始 IP。</p></div></header><main className="analytics-main">
    <section className="analytics-control"><label>管理员密钥<div className="analytics-key-field"><input type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} placeholder="输入 ADMIN_API_KEY" autoComplete="off" /><button type="button" className="analytics-key-toggle" onClick={() => setShowKey((visible) => !visible)} aria-label={showKey ? "隐藏管理员密钥" : "显示管理员密钥"} title={showKey ? "隐藏密钥" : "显示密钥"}>{showKey ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label><label>统计周期<select value={days} onChange={(event) => setDays(event.target.value)}><option value="today">今天</option><option value="yesterday">昨天</option><option value="7">最近 7 天</option><option value="30">最近 30 天</option></select></label><button onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "analytics-spin" : ""} /> {loading ? "加载中…" : "刷新数据"}</button></section>
    {message && <p className="analytics-message">{message}</p>}
    {summary && <><section className="analytics-kpis"><div><span>事件总量</span><strong>{number(summary.totals.total_events)}</strong><small>{summary.periodLabel || periodLabels[summary.range] || `最近 ${summary.days} 天`}</small></div><div><span>匿名访客</span><strong>{number(summary.totals.unique_visitors)}</strong><small>去重 anonymous ID</small></div><div><span>访问会话</span><strong>{number(summary.totals.unique_sessions)}</strong><small>去重 session ID</small></div><div><span>详情到外链点击率</span><strong>{clickRate}%</strong><small>{number(summary.totals.click_visitors)} 位点击访客 / {number(summary.totals.detail_visitors)} 位详情访客</small></div></section>
      <section className="analytics-section analytics-daily"><div className="analytics-section-title"><h2>每日事件趋势</h2><span><BarChart3 size={14} /> 按天统计</span></div><div className="analytics-daily-chart">{summary.daily.length ? summary.daily.map((row) => <div className="analytics-day" key={String(row.date || row.name)}><div className="analytics-day-bar" style={{ height: `${Math.max(4, (Number(row.count || 0) / peak) * 100)}%` }} title={`${row.date || row.name}: ${number(row.count)}`} /><small>{String(row.date || row.name || "").slice(5)}</small></div>) : <p className="analytics-muted">当前周期暂无趋势数据。</p>}</div></section>
      <div className="analytics-grid"><Ranking title="行为事件" rows={summary.events} /><Ranking title="热门商品" rows={summary.products} labelKey="id" /><Ranking title="平台入口" rows={summary.platforms} /><Ranking title="商品分类" rows={summary.categories} /><Ranking title="来源渠道" rows={summary.sources} /><Ranking title="推广媒介" rows={summary.media} /><Ranking title="推广活动" rows={summary.campaigns} /><Ranking title="访问设备" rows={summary.devices} /><Ranking title="语言环境" rows={summary.languages} /><Ranking title="访问页面" rows={summary.paths} /></div>
      <section className="analytics-section"><div className="analytics-section-title"><h2>关键行为与转化</h2><span>真实事件计数</span></div><div className="analytics-conversion-grid">{summary.conversions.length ? summary.conversions.map((row) => <div key={row.name}><span>{label(row.name)}</span><strong>{number(row.count)}</strong></div>) : <p className="analytics-muted">暂无转化事件。</p>}</div></section>
      <section className="analytics-section"><div className="analytics-section-title"><h2>搜索词表现</h2><span>含无结果搜索</span></div><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>搜索词</th><th>搜索次数</th><th>无结果次数</th><th>无结果占比</th></tr></thead><tbody>{summary.searches.length ? summary.searches.map((row, index) => <tr key={`${row.name}-${index}`}><td><strong>{row.name || "—"}</strong></td><td>{number(row.count)}</td><td>{number(row.no_result_count)}</td><td>{((Number(row.no_result_count || 0) / Math.max(1, Number(row.count || 0))) * 100).toFixed(1)}%</td></tr>) : <tr><td colSpan={4}>当前周期暂无搜索数据。</td></tr>}</tbody></table></div></section>
      <section className="analytics-section"><div className="analytics-section-title"><h2>最近事件明细</h2><span>{summary.recent.length} 条记录</span></div><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>事件</th><th>时间</th><th>商品 / 分类</th><th>平台</th><th>设备 / 语言</th><th>来源 / 搜索词</th></tr></thead><tbody>{summary.recent.map((row) => <tr key={row.id}><td><strong>{label(row.event_name)}</strong><small>{row.event_name}<br />{row.path || "—"}</small></td><td>{formatDate(row.occurred_at)}</td><td>{row.product_id || "—"}<small>{row.category || "未分类"}</small></td><td>{row.platform || "—"}</td><td>{row.device || "—"}<small>{row.language || "—"}</small></td><td>{row.utm_source || row.utm_campaign || "直接访问"}<small>{row.query || "—"}</small></td></tr>)}</tbody></table></div></section>
    </>}
  </main></div>;
}
