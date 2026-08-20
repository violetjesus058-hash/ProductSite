import { FormEvent, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { isCloudflareWorkerConfigured, submitProductRequest, type ProductRequestInput } from "@/lib/cloudflareRequests";

const initialForm: ProductRequestInput = { name: "", contact: "", productUrl: "", imageUrl: "", description: "", notes: "" };

export default function RequestProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [requestCode, setRequestCode] = useState("");

  if (!open) return null;
  const update = (field: keyof ProductRequestInput, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setRequestCode("");
    setSubmitting(true);
    try {
      const result = await submitProductRequest(form);
      setRequestCode(result.requestCode);
      setMessage("申请已提交，我们会尽快查看。");
      setForm(initialForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="request-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="request-dialog" role="dialog" aria-modal="true" aria-labelledby="request-product-title">
      <div className="request-dialog-head"><div><span className="request-eyebrow">CATALOG REQUEST</span><h2 id="request-product-title">申请上新产品</h2></div><button className="request-close" onClick={onClose} aria-label="关闭申请表单"><X size={18} /></button></div>
      <p className="request-intro">告诉我们你希望加入目录的产品，我们会根据链接和图片进行审核。</p>
      {!isCloudflareWorkerConfigured() && <div className="request-config-note">当前预览尚未连接 Cloudflare Worker。完成 Worker 配置后，这里的提交内容才会正式保存到 D1。</div>}
      <form onSubmit={submit} className="request-form">
        <label>姓名或昵称<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="例如 Alex" /></label>
        <label>联系方式<span className="optional-label">可选</span><input value={form.contact} onChange={(event) => update("contact", event.target.value)} placeholder="Email / Discord 用户名" /></label>
        <label>商品链接<span className="optional-label">可选</span><input type="url" value={form.productUrl} onChange={(event) => update("productUrl", event.target.value)} placeholder="https://..." /></label>
        <label>商品图片链接<span className="optional-label">可选</span><input type="url" value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="https://..." /></label>
        <label>产品描述<textarea required rows={4} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="请说明品牌、品类、款式或你希望加入的原因" /></label>
        <label>补充说明<span className="optional-label">可选</span><textarea rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="尺码、颜色或其他要求" /></label>
        {message && <div className={`request-message ${requestCode ? "is-success" : "is-error"}`}>{message}{requestCode && <strong>申请编号：{requestCode}</strong>}</div>}
        <div className="request-form-actions"><button type="submit" className="request-submit" disabled={submitting || !isCloudflareWorkerConfigured()}>{submitting ? "提交中…" : "提交申请"}</button><a className="request-discord" href="https://discord.gg/jtc399kUQV" target="_blank" rel="noreferrer"><MessageCircle size={15} /> Discord 反馈</a></div>
      </form>
    </section>
  </div>;
}
