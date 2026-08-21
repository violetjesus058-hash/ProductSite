import { FormEvent, useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { isCloudflareWorkerConfigured, submitProductRequest, type ProductRequestInput } from "@/lib/cloudflareRequests";
import { trackEvent } from "@/lib/analytics";

const initialForm: ProductRequestInput = { name: "", contact: "", productUrl: "", imageUrl: "", description: "", notes: "", website: "" };
const maxLengths = { name: 80, contact: 160, productUrl: 500, imageUrl: 500, description: 2000, notes: 1000 } as const;

function isSafeUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function RequestProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(initialForm);
  useEffect(() => { if (open) trackEvent("request_product_open"); }, [open]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [requestCode, setRequestCode] = useState("");

  if (!open) return null;
  const update = (field: keyof ProductRequestInput, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setRequestCode("");
    const cleanForm = Object.fromEntries(Object.entries(form).map(([field, value]) => [field, value.trim()])) as ProductRequestInput;
    if (!cleanForm.name || !cleanForm.description) { trackEvent("request_product_validation_error", { reason: "missing_required_fields" }); setMessage("Please enter your name and a product description."); return; }
    if (!isSafeUrl(cleanForm.productUrl) || !isSafeUrl(cleanForm.imageUrl)) { trackEvent("request_product_validation_error", { reason: "unsafe_url" }); setMessage("Please use a valid HTTP or HTTPS link."); return; }
    setSubmitting(true);
    try {
      const result = await submitProductRequest(cleanForm);
      trackEvent("request_product_submit", { status: "success", has_product_url: Boolean(cleanForm.productUrl), has_image_url: Boolean(cleanForm.imageUrl) });
      setRequestCode(result.requestCode);
      setMessage("Your request has been received. We will review it shortly.");
      setForm(initialForm);
    } catch (error) {
      trackEvent("request_product_submit", { status: "error" });
      setMessage(error instanceof Error ? error.message : "The request could not be submitted. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="request-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="request-dialog" role="dialog" aria-modal="true" aria-labelledby="request-product-title">
      <div className="request-dialog-head"><div><span className="request-eyebrow">CATALOG REQUEST</span><h2 id="request-product-title">Request a Product</h2></div><button className="request-close" onClick={onClose} aria-label="Close request form"><X size={18} /></button></div>
      <p className="request-intro">Tell us which product you would like to see in the catalog. We review the product details and links before adding anything.</p>
      {!isCloudflareWorkerConfigured() && <div className="request-config-note">This preview is not connected to the request service yet. Submissions will be saved after the Cloudflare Worker is configured.</div>}
      <form onSubmit={submit} className="request-form" noValidate>
        <label>Name or nickname<input required maxLength={maxLengths.name} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Alex" autoComplete="name" /></label>
        <label>Contact <span className="optional-label">Optional</span><input maxLength={maxLengths.contact} value={form.contact} onChange={(event) => update("contact", event.target.value)} placeholder="Email or Discord username" autoComplete="email" /></label>
        <label>Product link <span className="optional-label">Optional</span><input type="url" maxLength={maxLengths.productUrl} value={form.productUrl} onChange={(event) => update("productUrl", event.target.value)} placeholder="https://..." inputMode="url" /></label>
        <label>Product image link <span className="optional-label">Optional</span><input type="url" maxLength={maxLengths.imageUrl} value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="https://..." inputMode="url" /></label>
        <label>Product description<textarea required maxLength={maxLengths.description} rows={4} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Tell us the brand, category, style, and why it should be added." /></label>
        <label>Additional notes <span className="optional-label">Optional</span><textarea maxLength={maxLengths.notes} rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Size, color, or other requirements" /></label>
        <input className="request-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(event) => update("website", event.target.value)} />
        <p className="request-privacy-note">For abuse prevention, Cloudflare records limited request metadata such as an approximate IP, country, and device type. These details are visible only to catalog administrators and are not shown on the public status page.</p>
        {message && <div className={`request-message ${requestCode ? "is-success" : "is-error"}`}>{message}{requestCode && <strong>Request ID: {requestCode}</strong>}</div>}
        <div className="request-form-actions"><button type="submit" className="request-submit" disabled={submitting || !isCloudflareWorkerConfigured()}>{submitting ? "Submitting…" : "Submit request"}</button><a className="request-discord" href="https://discord.gg/jtc399kUQV" target="_blank" rel="noreferrer" onClick={() => trackEvent("outbound_click", { destination: "Discord", location: "request_dialog" })}><MessageCircle size={15} /> Discord feedback</a></div><a className="request-status-link" href="/requests/status">Already have a request ID? Check status</a>
      </form>
    </section>
  </div>;
}
