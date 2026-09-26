"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { CalendarOff, Loader2, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const inputCls =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

export default function TeacherLeavePage() {
  const [requests, setRequests] = useState([]);
  const [balance, setBalance] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", from_date: "", to_date: "", reason: "" });

  const load = async () => {
    try {
      const [req, bal, tp] = await Promise.all([
        apiFetch("/api/leave/requests"),
        apiFetch("/api/leave/balance"),
        apiFetch("/api/leave/types"),
      ]);
      setRequests(req.requests || []);
      setBalance(bal.balance || []);
      setTypes(tp.types || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/leave/requests", { method: "POST", body: form });
      toast.success("Leave request submitted");
      setShowForm(false);
      setForm({ leave_type_id: "", from_date: "", to_date: "", reason: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <CalendarOff className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Leave</h1>
            <p className="text-sm text-zinc-500">View balance and request time off.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Apply Leave"}
        </button>
      </div>

      {balance.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {balance.map((b) => (
            <div key={b.type || b.leave_type} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{b.type || b.leave_type}</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{b.remaining ?? b.available ?? "—"}</p>
              <p className="text-xs text-zinc-500">of {b.total ?? b.allocated ?? "—"} days</p>
            </div>
          ))}
        </motion.div>
      )}

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={onSubmit}
          className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-zinc-900">Apply for Leave</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Leave type</label>
              <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))} required className={inputCls}>
                <option value="">Select type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">From</label>
              <input type="date" value={form.from_date} onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">To</label>
              <input type="date" value={form.to_date} onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))} required className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={3} className={inputCls} placeholder="Reason for leave..." />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Request
          </button>
        </motion.form>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">My Requests</h2>
        </div>
        {requests.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">No leave requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-zinc-800">{r.leave_type_name || r.leave_type || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{r.from_date ? new Date(r.from_date).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3 text-zinc-600">{r.to_date ? new Date(r.to_date).toLocaleDateString() : "—"}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-zinc-500">{r.reason || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[r.status] || "bg-zinc-100 text-zinc-700"}`}>
                        {r.status}
                      </span>
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
