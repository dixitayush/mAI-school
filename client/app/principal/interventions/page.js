"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2, Bell } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  monitoring: "bg-cyan-100 text-cyan-800",
  resolved: "bg-emerald-100 text-emerald-800",
  escalated: "bg-red-100 text-red-800",
};

export default function PrincipalInterventionsPage() {
  const [interventions, setInterventions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", concern_type: "" });

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

  const filtered = interventions.filter((i) => {
    if (filter.status && i.status !== filter.status) return false;
    if (filter.concern_type && i.concern_type !== filter.concern_type) return false;
    return true;
  });

  const unacknowledged = signals.filter((s) => !s.acknowledged);
  const statusCounts = {};
  interventions.forEach((i) => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Interventions</h1>
          <p className="text-sm text-zinc-500">School-wide student intervention dashboard.</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {["open", "in_progress", "monitoring", "escalated", "resolved"].map((s) => (
          <div key={s} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{s}</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{statusCounts[s] || 0}</p>
          </div>
        ))}
      </motion.div>

      {unacknowledged.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Bell className="h-4 w-4" /> {unacknowledged.length} unacknowledged signal{unacknowledged.length > 1 ? "s" : ""}
          </h2>
          {unacknowledged.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">{s.student_name || "Student"} — {s.signal_type || s.type}</p>
                <p className="text-xs text-amber-700">{s.message || s.description || "Requires attention"}</p>
              </div>
              <button
                onClick={() => acknowledge(s.id)}
                className="rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="monitoring">Monitoring</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={filter.concern_type}
          onChange={(e) => setFilter((f) => ({ ...f, concern_type: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All types</option>
          <option value="academic">Academic</option>
          <option value="behavioral">Behavioral</option>
          <option value="attendance">Attendance</option>
          <option value="social_emotional">Social/Emotional</option>
          <option value="health">Health</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">No interventions match the filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Teacher</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((intv) => (
                  <tr key={intv.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-zinc-800">{intv.student_name || intv.student_id?.slice(0, 8) || "—"}</td>
                    <td className="px-5 py-3 text-zinc-600 capitalize">{intv.concern_type}</td>
                    <td className="px-5 py-3 text-zinc-600">{intv.owner_name || intv.created_by_name || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[intv.status] || "bg-zinc-100 text-zinc-700"}`}>
                        {intv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{intv.created_at ? new Date(intv.created_at).toLocaleDateString() : "—"}</td>
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
