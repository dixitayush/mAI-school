"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { FileText, Loader2, Plus, Download, CheckCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ student_id: "", type: "bonafide", template_id: "" });
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    apiFetch("/api/documents?category=certificate")
      .then((data) => setCertificates(data.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    if (!form.student_id) return toast.error("Student ID is required");
    setGenerating(true);
    try {
      await apiFetch("/api/documents/certificates/generate", { method: "POST", body: form });
      toast.success("Certificate generated");
      setShowGenerate(false);
      setForm({ student_id: "", type: "bonafide", template_id: "" });
      const data = await apiFetch("/api/documents?category=certificate");
      setCertificates(data.documents || []);
    } catch (err) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const verify = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    try {
      const data = await apiFetch(`/api/documents/certificates/verify/${verifyCode}`);
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ valid: false });
      toast.error(err.message);
    }
    finally { setVerifying(false); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const TYPE_COLORS = { bonafide: "bg-blue-100 text-blue-800", transfer: "bg-amber-100 text-amber-800", character: "bg-emerald-100 text-emerald-800", achievement: "bg-violet-100 text-violet-800" };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><FileText className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Certificates</h1>
            <p className="text-sm text-zinc-500">Generate and verify student certificates.</p>
          </div>
        </div>
        <button onClick={() => setShowGenerate(!showGenerate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Generate
        </button>
      </div>

      {showGenerate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={generate} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))} placeholder="Student ID" className={inputCls} required />
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
            <option value="bonafide">Bonafide Certificate</option>
            <option value="transfer">Transfer Certificate</option>
            <option value="character">Character Certificate</option>
            <option value="achievement">Achievement Certificate</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={generating} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Generate
            </button>
            <button type="button" onClick={() => setShowGenerate(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
          </div>
        </motion.form>
      )}

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Verify Certificate</h3>
        <div className="flex gap-2">
          <input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="Enter verification code" className={`${inputCls} flex-1`} />
          <button onClick={verify} disabled={verifying} className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-60">
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Verify
          </button>
        </div>
        {verifyResult && (
          <div className={`mt-3 rounded-xl p-3 text-sm ${verifyResult.valid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
            {verifyResult.valid ? `Valid certificate — ${verifyResult.type} for ${verifyResult.student}, issued ${new Date(verifyResult.issued_at).toLocaleDateString()}` : "Invalid or expired certificate code."}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : certificates.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No certificates generated yet.</div>
      ) : (
        <div className="space-y-2">
          {certificates.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium text-zinc-800">{c.title}</p>
                <p className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[c.category] || "bg-zinc-100 text-zinc-600"}`}>{c.category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
