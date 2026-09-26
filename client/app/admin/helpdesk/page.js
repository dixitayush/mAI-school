"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { LifeBuoy, Plus, Loader2, X, Send, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-zinc-100 text-zinc-700",
};

const PRIORITY_COLORS = {
  low: "bg-zinc-100 text-zinc-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
  urgent: "bg-red-200 text-red-900",
};

export default function HelpdeskPage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium", category: "general" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketData, statsData] = await Promise.all([
        apiFetch("/api/helpdesk"),
        apiFetch("/api/helpdesk/dashboard/stats"),
      ]);
      setTickets(ticketData.tickets || []);
      setStats(statsData.stats || {});
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const viewTicket = async (id) => {
    try {
      const data = await apiFetch(`/api/helpdesk/${id}`);
      setDetail(data.ticket || data);
      setComments(data.comments || []);
      setSelected(id);
    } catch (err) { toast.error(err.message); }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await apiFetch(`/api/helpdesk/${selected}/comments`, { method: "POST", body: { content: commentText } });
      setCommentText("");
      viewTicket(selected);
    } catch (err) { toast.error(err.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiFetch(`/api/helpdesk/${id}`, { method: "PATCH", body: { status } });
      toast.success(`Ticket ${status.replace("_", " ")}`);
      fetchData();
      if (selected === id) viewTicket(id);
    } catch (err) { toast.error(err.message); }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/helpdesk", { method: "POST", body: form });
      toast.success("Ticket created");
      setShowForm(false);
      setForm({ subject: "", description: "", priority: "medium", category: "general" });
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  if (selected && detail) {
    return (
      <div className="mx-auto max-w-3xl">
        <button onClick={() => { setSelected(null); setDetail(null); }} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">{detail.subject}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[detail.status] || ""}`}>{detail.status?.replace("_", " ")}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIORITY_COLORS[detail.priority] || ""}`}>{detail.priority}</span>
              </div>
            </div>
            <select value="" onChange={(e) => { if (e.target.value) updateStatus(detail.id, e.target.value); }}
              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
              <option value="">Change status...</option>
              {["open", "in_progress", "resolved", "closed"].filter((s) => s !== detail.status).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
          <p className="mb-6 text-sm text-zinc-600">{detail.description}</p>
          <div className="border-t border-zinc-100 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-700">Comments</h3>
            <div className="space-y-3 mb-4">
              {comments.length === 0 ? <p className="text-sm text-zinc-400">No comments yet.</p> : comments.map((c, i) => (
                <div key={i} className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-sm text-zinc-800">{c.content}</p>
                  <p className="mt-1 text-xs text-zinc-400">{c.author_name || "—"} · {c.created_at ? new Date(c.created_at).toLocaleString() : ""}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className={inputCls}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }} />
              <button onClick={addComment} className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-white hover:bg-primary-700"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><LifeBuoy className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Helpdesk</h1><p className="text-sm text-zinc-500">Support tickets and issue tracking.</p></div>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: "Open", key: "open", color: "text-blue-600" }, { label: "In Progress", key: "in_progress", color: "text-amber-600" },
          { label: "Resolved", key: "resolved", color: "text-emerald-600" }, { label: "Closed", key: "closed", color: "text-zinc-500" }].map((s) => (
          <div key={s.key} className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{stats[s.key] || 0}</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">New Ticket</h2>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Subject</label><input required value={form.subject} onChange={set("subject")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Description</label><textarea rows={3} value={form.description} onChange={set("description")} className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium text-zinc-700">Priority</label>
                <select value={form.priority} onChange={set("priority")} className={inputCls}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-zinc-700">Category</label>
                <select value={form.category} onChange={set("category")} className={inputCls}><option value="general">General</option><option value="it">IT</option><option value="facilities">Facilities</option><option value="academic">Academic</option></select>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create Ticket
            </button>
          </form>
        </motion.div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">No tickets found.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => viewTicket(t.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-zinc-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-800">{t.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{t.requester_name || "—"} · {t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[t.status] || ""}`}>{t.status?.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
