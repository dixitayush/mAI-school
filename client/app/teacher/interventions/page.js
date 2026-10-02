"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2, Plus, X, Bell } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  monitoring: "bg-cyan-100 text-cyan-800",
  resolved: "bg-emerald-100 text-emerald-800",
  escalated: "bg-red-100 text-red-800",
};

const inputCls =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

export default function TeacherInterventionsPage() {
  const [interventions, setInterventions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ student_id: "", concern_type: "academic", title: "", description: "" });

  const load = async () => {
    try {
      const [intv, sig] = await Promise.all([
        apiFetch("/api/interventions"),
        apiFetch("/api/interventions/signals"),
      ]);
      setInterventions(intv.interventions || []);
      setSignals(sig.signals || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const acknowledge = async (id) => {
    try {
      await apiFetch(`/api/interventions/signals/${id}/acknowledge`, { method: "PATCH" });
      toast.success("Signal acknowledged");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/interventions", { method: "POST", body: form });
      toast.success("Intervention created");
      setShowForm(false);
      setForm({ student_id: "", concern_type: "academic", title: "", description: "" });
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

  const unacknowledged = signals.filter((s) => !s.acknowledged);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Interventions</h1>
            <p className="text-sm text-zinc-500">Track and support at-risk students.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New Intervention"}
        </button>
      </div>

      {unacknowledged.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-2">
          {unacknowledged.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">{s.student_name || "Student"}{s.registration_id ? ` (${s.registration_id})` : ""} — {s.signal_type || s.type}</p>
                  <p className="text-xs text-amber-700">{s.message || s.description || "Requires attention"}</p>
                </div>
              </div>
              <button
                onClick={() => acknowledge(s.id)}
                className="rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300"
              >
                Acknowledge
              </button>
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
          <h2 className="text-lg font-semibold text-zinc-900">Create Intervention</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Student ID</label>
              <input value={form.student_id} onChange={(e) => setForm((f) => ({ ...f, student_id: e.target.value }))} required className={inputCls} placeholder="Student UUID" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Concern Type</label>
              <select value={form.concern_type} onChange={(e) => setForm((f) => ({ ...f, concern_type: e.target.value }))} className={inputCls}>
                <option value="academic">Academic</option>
                <option value="behavioral">Behavioral</option>
                <option value="attendance">Attendance</option>
                <option value="social_emotional">Social/Emotional</option>
                <option value="health">Health</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className={inputCls} placeholder="Brief title for this intervention" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create
          </button>
        </motion.form>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Active Interventions</h2>
        </div>
        {interventions.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">No interventions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {interventions.map((intv) => (
                  <tr key={intv.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-zinc-800">
                      {intv.student_name || "—"}
                      <span className="ml-1.5 font-mono text-xs font-semibold text-indigo-600">{intv.registration_id}</span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 capitalize">{intv.concern_type}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[intv.status] || "bg-zinc-100 text-zinc-700"}`}>
                        {intv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{intv.created_at ? new Date(intv.created_at).toLocaleDateString() : "—"}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-zinc-400">{intv.description || "—"}</td>
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
