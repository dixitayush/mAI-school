"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Loader2, CheckCircle, X, Bell } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ student_id: "", concern_type: "academic", title: "", description: "" });

  const fetchData = async () => {
    try {
      const [intData, sigData] = await Promise.all([
        apiFetch("/api/interventions"),
        apiFetch("/api/interventions/signals"),
      ]);
      setInterventions(intData.interventions || []);
      setSignals(sigData.signals || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const acknowledge = async (signalId) => {
    try {
      await apiFetch(`/api/interventions/signals/${signalId}/acknowledge`, { method: "PATCH" });
      toast.success("Signal acknowledged");
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.title) return toast.error("Student ID and title are required");
    setCreating(true);
    try {
      await apiFetch("/api/interventions", { method: "POST", body: form });
      toast.success("Intervention created");
      setShowCreate(false);
      setForm({ student_id: "", concern_type: "academic", title: "", description: "" });
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiFetch(`/api/interventions/${id}`, { method: "PATCH", body: { status } });
      toast.success("Status updated");
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const STATUS = { open: "bg-amber-100 text-amber-800", in_progress: "bg-blue-100 text-blue-800", monitoring: "bg-cyan-100 text-cyan-800", resolved: "bg-emerald-100 text-emerald-800", escalated: "bg-red-100 text-red-800" };
  const TYPE_COLORS = { academic: "bg-violet-100 text-violet-800", behavioral: "bg-amber-100 text-amber-800", attendance: "bg-blue-100 text-blue-800", social_emotional: "bg-pink-100 text-pink-800", health: "bg-emerald-100 text-emerald-800" };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><AlertTriangle className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Interventions</h1>
            <p className="text-sm text-zinc-500">Early warning signals and student support tracking.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Intervention
        </button>
      </div>

      {signals.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><Bell className="h-4 w-4" /> Unacknowledged Signals</div>
          {signals.filter(s => !s.acknowledged).map(sig => (
            <div key={sig.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="text-sm font-medium text-amber-900">{sig.signal_type}: {sig.student_name || sig.student_id?.slice(0, 8)}</p>
                <p className="text-xs text-amber-700">{sig.description || sig.reason}</p>
              </div>
              <button onClick={() => acknowledge(sig.id)} className="inline-flex items-center gap-1 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300">
                <CheckCircle className="h-3.5 w-3.5" /> Acknowledge
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {showCreate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={onCreate} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} placeholder="Student ID" className={inputCls} required />
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Intervention title" className={inputCls} required />
          <select value={form.concern_type} onChange={e => setForm(f => ({ ...f, concern_type: e.target.value }))} className={inputCls}>
            <option value="academic">Academic</option><option value="behavioral">Behavioral</option><option value="attendance">Attendance</option><option value="social_emotional">Social/Emotional</option><option value="health">Health</option>
          </select>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the concern..." rows={3} className={inputCls} />
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : interventions.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No interventions recorded.</div>
      ) : (
        <div className="space-y-3">
          {interventions.map(int => (
            <div key={int.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{int.title || int.student_name || `Student ${int.student_id?.slice(0, 8)}`}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{int.student_name} · {int.description?.slice(0, 80)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[int.concern_type] || TYPE_COLORS.academic}`}>{int.concern_type}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[int.status] || STATUS.open}`}>{int.status}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {int.status !== "resolved" && (
                  <button onClick={() => updateStatus(int.id, "resolved")} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Resolve</button>
                )}
                {int.status === "active" && (
                  <button onClick={() => updateStatus(int.id, "escalated")} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Escalate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
