import { FormEvent, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Link } from "wouter";
import { getProductRequest } from "@/lib/cloudflareRequests";

type RequestResult = { requestCode: string; name: string; productUrl: string | null; description: string; status: string; adminReply: string | null; createdAt: string; updatedAt: string };

export default function RequestStatus() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RequestResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setResult(null); setMessage(""); setLoading(true);
    try { setResult(await getProductRequest(code.trim())); }
    catch (error) { setMessage(error instanceof Error ? error.message : "查询失败，请稍后重试。"); }
    finally { setLoading(false); }
  };
  return <div className="request-status-page"><header className="request-status-header"><Link href="/" className="admin-back"><ArrowLeft size={15} /> 返回目录</Link><div><span className="request-eyebrow">CATALOG REQUEST</span><h1>查询上新申请</h1></div></header><main className="request-status-card"><p>输入提交申请后获得的编号，查看当前处理状态和管理员回复。</p><form onSubmit={submit} className="request-status-form"><label>申请编号<input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="例如 REQ-20260820-ABC123" /></label><button type="submit" disabled={loading}><Search size={15} /> {loading ? "查询中…" : "查询状态"}</button></form>{message && <div className="request-status-message is-error">{message}</div>}{result && <section className="request-status-result"><div className="request-status-result-head"><strong>{result.requestCode}</strong><span>{result.status}</span></div><dl><div><dt>申请人</dt><dd>{result.name}</dd></div><div><dt>提交时间</dt><dd>{result.createdAt}</dd></div></dl><h2>产品描述</h2><p>{result.description}</p>{result.productUrl && <a href={result.productUrl} target="_blank" rel="noreferrer">查看商品链接</a>}<h2>管理员回复</h2><p className={result.adminReply ? "" : "is-muted"}>{result.adminReply || "目前还没有回复，请稍后再查询。"}</p></section>}</main></div>;
}
