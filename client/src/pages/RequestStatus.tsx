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
    try { setResult(await getProductRequest(code.trim().toUpperCase())); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The request could not be found. Please try again."); }
    finally { setLoading(false); }
  };
  return <div className="request-status-page"><header className="request-status-header"><Link href="/" className="admin-back"><ArrowLeft size={15} /> Back to catalog</Link><div><span className="request-eyebrow">CATALOG REQUEST</span><h1>Check Request Status</h1></div></header><main className="request-status-card"><p>Enter the request ID you received after submitting a product. You can view its current status and any administrator reply here.</p><form onSubmit={submit} className="request-status-form"><label>Request ID<input required maxLength={22} value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. REQ-20260820-ABC123" autoCapitalize="characters" /></label><button type="submit" disabled={loading}><Search size={15} /> {loading ? "Checking…" : "Check status"}</button></form>{message && <div className="request-status-message is-error">{message}</div>}{result && <section className="request-status-result"><div className="request-status-result-head"><strong>{result.requestCode}</strong><span>{result.status}</span></div><dl><div><dt>Submitted by</dt><dd>{result.name}</dd></div><div><dt>Submitted</dt><dd>{result.createdAt}</dd></div></dl><h2>Product description</h2><p>{result.description}</p>{result.productUrl && <a href={result.productUrl} target="_blank" rel="noreferrer">View product link</a>}<h2>Administrator reply</h2><p className={result.adminReply ? "" : "is-muted"}>{result.adminReply || "No reply yet. Please check again later."}</p></section>}</main></div>;
}
