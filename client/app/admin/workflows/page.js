"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Workflow, Plus, Loader2, Play, Pause, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_event: "", description: "" });

  const fetchWorkflows = async () => {
    try {
      const data = await apiFetch("/api/workflows");
      setWorkflows(data.workflows || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWorkflows(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.trigger_event) return toast.error("Name and trigger are required");
    setCreating(true);
    try {
      await apiFetch("/api/workflows", { method: "POST", body: form });
      toast.success("Workflow created");
      setShowCreate(false);
      setForm({ name: "", trigger_event: "", description: "" });
      fetchWorkflows();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const toggleActive = async (wf) => {
    try {
      await apiFetch(`/api/workflows/${wf.id}`, { method: "PATCH", body: { active: !wf.active } });
      toast.success(wf.active ? "Workflow paused" : "Workflow activated");
      fetchWorkflows();
    } catch (err) { toast.error(err.message); }
  };

  const deleteWf = async (id) => {
    if (!confirm("Delete this workflow?")) return;
    try {
      await apiFetch(`/api/workflows/${id}`, { method: "DELETE" });
      toast.success("Workflow deleted");
      fetchWorkflows();
    } catch (err) { toast.error(err.message); }
  };

  const triggerWf = async (id) => {
    try {
      await apiFetch(`/api/workflows/${id}/trigger`, { method: "POST" });
      toast.success("Workflow triggered");
    } catch (err) { toast.error(err.message); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Workflow className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Workflows</h1>
            <p className="text-sm text-zinc-500">Automate approval flows and event-triggered actions.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Workflow
        </button>
      </div>

      {showCreate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={onCreate} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Workflow name" className={inputCls} required />
          <select value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))} className={inputCls} required>
            <option value="">Select trigger event...</option>
            <option value="leave_request">Leave Request Submitted</option>
            <option value="expense_submitted">Expense Submitted</option>
            <option value="fee_overdue">Fee Overdue</option>
            <option value="attendance_below_threshold">Attendance Below Threshold</option>
            <option value="new_admission">New Admission</option>
          </select>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className={inputCls} />
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
      ) : workflows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No workflows configured. Create one to automate school processes.</div>
      ) : (
        <div className="space-y-3">
          {workflows.map(wf => (
            <div key={wf.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <p className="font-semibold text-zinc-900">{wf.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">Trigger: {wf.trigger_event} {wf.description ? `· ${wf.description}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${wf.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
                  {wf.active ? "Active" : "Paused"}
                </span>
                <button onClick={() => triggerWf(wf.id)} title="Trigger manually" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-primary-600"><Play className="h-4 w-4" /></button>
                <button onClick={() => toggleActive(wf)} title={wf.active ? "Pause" : "Activate"} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-amber-600">
                  {wf.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button onClick={() => deleteWf(wf.id)} title="Delete" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
