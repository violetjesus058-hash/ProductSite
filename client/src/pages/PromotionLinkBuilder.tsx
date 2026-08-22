import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Link2, LockKeyhole } from "lucide-react";
import { Link } from "wouter";

const workerUrl = String(import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/$/, "");
const KEY_NAME = "productsite-admin-key";
const TRAFFIC_SOURCES = ["Kakobuy", "Fast logistics", "Superbuy", "Litbuy", "GTbuy", "Oopbuy", "Hipobuy", "Fansbuy", "LoveGoBuy", "Hoobuy", "UsFans", "AllChinaBuy", "Mulebuy", "AcBuy", "Joyagoo", "OrientDig", "Sugargoo", "BBDBuyEU", "VigorBuy", "Fishgoo"];

export default function PromotionLinkBuilder() {
  const [key, setKey] = useState(() => localStorage.getItem(KEY_NAME) || "");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState(TRAFFIC_SOURCES[0]);
  const [medium, setMedium] = useState("video");
  const [campaign, setCampaign] = useState("catalog-launch");
  const [content, setContent] = useState("description");
  const [target, setTarget] = useState("home");
  const [productId, setProductId] = useState("");
  const [copied, setCopied] = useState(false);

  const generatedUrl = useMemo(() => {
    const path = target === "product" && productId.trim() ? `/product/${encodeURIComponent(productId.trim())}` : "/";
    const url = new URL(path, window.location.origin);
    const values = { utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_content: content };
    Object.entries(values).forEach(([name, value]) => { if (value.trim()) url.searchParams.set(name, value.trim().toLowerCase().replace(/\s+/g, "-")); });
    return url.toString();
  }, [campaign, content, medium, productId, source, target]);

  const unlock = async () => {
    if (!workerUrl || !key.trim()) { setMessage("请输入管理员密钥。"); return; }
    setMessage("");
    const response = await fetch(`${workerUrl}/api/admin/analytics/summary?range=today`, { headers: { "x-admin-api-key": key.trim() } }).catch(() => null);
    if (!response?.ok) { setMessage(response?.status === 401 ? "管理员密钥不正确。" : "无法连接 Worker，请检查部署和网络。"); return; }
    localStorage.setItem(KEY_NAME, key.trim()); setUnlocked(true);
  };

  const copy = async () => { await navigator.clipboard.writeText(generatedUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  if (!unlocked) return <div className="analytics-page"><header className="analytics-header"><Link href="/admin/analytics" className="admin-back"><ArrowLeft size={15} /> 返回数据面板</Link><div><span className="request-eyebrow">PRODUCTSITE 推广工具</span><h1>推广链接生成器</h1><p>管理员专用。先验证密钥，再生成带渠道归因的链接。</p></div></header><main className="analytics-main"><section className="analytics-section link-builder-gate"><LockKeyhole size={24} /><h2>管理员验证</h2><label>ADMIN_API_KEY<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="输入管理员密钥" autoComplete="off" /></label><button onClick={() => void unlock()}>验证并进入</button>{message && <p className="analytics-message">{message}</p>}</section></main></div>;

  return <div className="analytics-page"><header className="analytics-header"><Link href="/admin/analytics" className="admin-back"><ArrowLeft size={15} /> 返回数据面板</Link><div><span className="request-eyebrow">PRODUCTSITE 推广工具</span><h1>推广链接生成器</h1><p>填写一次，生成可以直接发布到 YouTube、TikTok、Instagram 或 Discord 的链接。</p></div></header><main className="analytics-main"><section className="link-builder-layout"><section className="analytics-section"><div className="analytics-section-title"><h2>设置链接参数</h2><span><Link2 size={14} /> UTM 归因</span></div><div className="link-builder-form"><label>流量来源<span>请选择推广来源平台</span><select value={source} onChange={(event) => setSource(event.target.value)}>{TRAFFIC_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>推广媒介<span>例如 video、bio、community</span><input value={medium} onChange={(event) => setMedium(event.target.value)} placeholder="video" /></label><label>推广活动<span>例如 catalog-launch、summer-2026</span><input value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="catalog-launch" /></label><label>投放位置<span>例如 description、pinned-comment、profile</span><input value={content} onChange={(event) => setContent(event.target.value)} placeholder="description" /></label><label>目标页面<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="home">网站首页</option><option value="product">具体商品详情页</option></select></label>{target === "product" && <label>商品 ID<input value={productId} onChange={(event) => setProductId(event.target.value.replace(/[^0-9]/g, ""))} placeholder="例如 7572868073" inputMode="numeric" /></label>}</div></section><section className="analytics-section link-builder-result"><div className="analytics-section-title"><h2>生成的推广链接</h2><span>点击后直接进入网站</span></div><div className="link-builder-output"><code>{generatedUrl}</code><button onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "已复制" : "复制链接"}</button><a href={generatedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 打开测试</a></div><p className="analytics-muted">用户不会看到中间跳转页。来源、媒介、活动和投放位置会自动写入分析数据。</p></section></section></main></div>;
}
