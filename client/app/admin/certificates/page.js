"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { FileText, Loader2, Plus, CheckCircle, XCircle, Ban, Copy } from "lucide-react";
import { apiFetch } from "@/lib/api";

const TYPES = [
  { value: "bonafide", label: "Bonafide Certificate" },
  { value: "transfer", label: "Transfer Certificate" },
  { value: "character", label: "Character Certificate" },
  { value: "achievement", label: "Achievement Certificate" },
  { value: "participation", label: "Participation Certificate" },
];

const TYPE_COLORS = {
  bonafide: "bg-blue-100 text-blue-800",
  transfer: "bg-amber-100 text-amber-800",
  character: "bg-emerald-100 text-emerald-800",
  achievement: "bg-violet-100 text-violet-800",
  participation: "bg-sky-100 text-sky-800",
};

const EMPTY_FORM = { student_id: "", type: "bonafide", template_id: "", purpose: "" };

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [certData, studentData, tplData] = await Promise.all([
        apiFetch("/api/documents/certificates"),
        apiFetch("/api/students?limit=1000"),
        apiFetch("/api/documents/certificates/templates"),
      ]);
      setCertificates(certData.certificates || []);
      setStudents(studentData.students || []);
      setTemplates(tplData.templates || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async (e) => {
    e.preventDefault();
    if (!form.student_id) return toast.error("Pick a student");
    setGenerating(true);
    try {
      const res = await apiFetch("/api/documents/certificates/generate", {
        method: "POST",
        body: {
          student_id: form.student_id,
          type: form.type,
          template_id: form.template_id || null,
          data: form.purpose ? { purpose: form.purpose } : {},
        },
      });
      toast.success(`Certificate generated — code ${res.certificate.verification_code}`);
      setShowGenerate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (cert) => {
    try {
      await apiFetch(`/api/documents/certificates/${cert.id}/revoke`, { method: "PATCH" });
      toast.success("Certificate revoked");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const verify = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    try {
      const data = await apiFetch(`/api/documents/certificates/verify/${verifyCode.trim()}`);
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const inputCls =
    "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const templatesForType = templates.filter((t) => t.type === form.type);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Certificates</h1>
            <p className="text-sm text-zinc-500">Generate, verify and revoke student certificates.</p>
          </div>
        </div>
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Generate
        </button>
      </div>

      {showGenerate && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={generate}
          className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Student</label>
            <select
              required
              value={form.student_id}
              onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.class_name ? ` — ${s.class_name}` : ""}
                  {s.roll_number ? ` #${s.roll_number}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, template_id: "" }))}
              className={inputCls}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Template</label>
            <select
              value={form.template_id}
              onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Default wording</option>
              {templatesForType.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Purpose / note</label>
            <input
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Bank account opening"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Generate certificate
            </button>
          </div>
        </motion.form>
      )}

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Verify a certificate</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="Verification code, e.g. BON-1A2B3C4D"
            className="w-72 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
          />
          <button
            onClick={verify}
            disabled={verifying}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Verify
          </button>
        </div>
        {verifyResult && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl p-4 text-sm ${
              verifyResult.valid ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
            }`}
          >
            {verifyResult.valid ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              {verifyResult.valid ? (
                <>
                  <p className="font-semibold">Valid certificate</p>
                  <p>
                    {verifyResult.type} for {verifyResult.student}
                    {verifyResult.class_name ? ` (${verifyResult.class_name})` : ""} — {verifyResult.school}
                  </p>
                  <p className="text-xs opacity-80">
                    Issued {new Date(verifyResult.issued_at).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="font-semibold">
                  {verifyResult.revoked ? "This certificate has been revoked." : verifyResult.error || "Not found."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Issued certificates</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : certificates.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">No certificates issued yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{c.student_name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.class_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          TYPE_COLORS[c.type] || "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyCode(c.verification_code)}
                        className="inline-flex items-center gap-1 font-mono text-xs text-zinc-600 hover:text-primary-700"
                        title="Copy code"
                      >
                        {c.verification_code} <Copy className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(c.generated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {c.revoked_at ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          Revoked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Valid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!c.revoked_at && (
                        <button
                          onClick={() => revoke(c)}
                          title="Revoke"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
