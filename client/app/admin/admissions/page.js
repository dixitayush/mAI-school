"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ClipboardCheck, Plus, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  inquiry: "bg-zinc-100 text-zinc-700",
  applied: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  enrolled: "bg-primary-100 text-primary-800",
  rejected: "bg-red-100 text-red-800",
};

const STATUSES = ["inquiry", "applied", "under_review", "accepted", "enrolled", "rejected"];

const EMPTY_FORM = {
  applicant_name: "", date_of_birth: "", gender: "male", requested_grade: "",
  guardian_name: "", guardian_phone: "", guardian_email: "", address: "",
};

export default function AdmissionsPage() {
  const [apps, setApps] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      const [listData, summaryData] = await Promise.all([
        apiFetch(`/api/admissions?${params}`),
        apiFetch("/api/admissions/pipeline/summary"),
      ]);
      setApps(listData.applications || []);
      setTotal(listData.total || 0);
      setSummary(summaryData.summary || {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id, status) => {
    try {
      await apiFetch(`/api/admissions/${id}/status`, { method: "PATCH", body: { status } });
      toast.success(`Status updated to ${status}`);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/admissions", { method: "POST", body: form });
      toast.success("Application created");
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const totalPages = Math.ceil(total / limit) || 1;
  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Admissions</h1>
            <p className="text-sm text-zinc-500">Manage applications and enrollment pipeline.</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Application
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(statusFilter === s ? "" : s); setPage(1); }}
            className={`rounded-2xl border p-4 text-center transition ${statusFilter === s ? "border-primary-300 bg-primary-50 ring-2 ring-primary-500/20" : "border-zinc-200 bg-white shadow-sm hover:shadow-md"}`}>
            <p className="text-2xl font-bold text-zinc-900">{summary[s] || 0}</p>
            <p className="mt-1 text-xs font-medium capitalize text-zinc-500">{s.replace("_", " ")}</p>
          </button>
        ))}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">New Application</h2>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Applicant Name</label><input required value={form.applicant_name} onChange={set("applicant_name")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Date of Birth</label><input type="date" required value={form.date_of_birth} onChange={set("date_of_birth")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Gender</label>
              <select value={form.gender} onChange={set("gender")} className={inputCls}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Requested Grade</label><input required value={form.requested_grade} onChange={set("requested_grade")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Guardian Name</label><input value={form.guardian_name} onChange={set("guardian_name")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Guardian Phone</label><input value={form.guardian_phone} onChange={set("guardian_phone")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Guardian Email</label><input type="email" value={form.guardian_email} onChange={set("guardian_email")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Address</label><input value={form.address} onChange={set("address")} className={inputCls} /></div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
        ) : apps.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">No applications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Guardian</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {apps.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-800">{app.applicant_name}</td>
                    <td className="px-4 py-3 text-zinc-600">{app.requested_grade}</td>
                    <td className="px-4 py-3 text-zinc-500">{app.guardian_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[app.status] || "bg-zinc-100 text-zinc-700"}`}>{app.status?.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{app.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <select value="" onChange={(e) => { if (e.target.value) updateStatus(app.id, e.target.value); }}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
                        <option value="">Move to...</option>
                        {STATUSES.filter((s) => s !== app.status).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3">
            <p className="text-sm text-zinc-500">{total} applications</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-medium text-zinc-700">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
