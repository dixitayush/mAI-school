"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { CalendarDays, Plus, Loader2, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", event_date: "", event_type: "general", location: "" });

  const fetchEvents = async () => {
    try {
      const data = await apiFetch("/api/events");
      setEvents(data.events || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.event_date) return toast.error("Title and date are required");
    setCreating(true);
    try {
      await apiFetch("/api/events", { method: "POST", body: form });
      toast.success("Event created");
      setShowCreate(false);
      setForm({ title: "", description: "", event_date: "", event_type: "general", location: "" });
      fetchEvents();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const deleteEvent = async (id) => {
    if (!confirm("Delete this event?")) return;
    try {
      await apiFetch(`/api/events/${id}`, { method: "DELETE" });
      toast.success("Event deleted");
      fetchEvents();
    } catch (err) { toast.error(err.message); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const TYPE_COLORS = { general: "bg-blue-100 text-blue-800", academic: "bg-primary-100 text-primary-800", sports: "bg-amber-100 text-amber-800", cultural: "bg-violet-100 text-violet-800", pta: "bg-pink-100 text-pink-800" };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><CalendarDays className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">School Events</h1>
            <p className="text-sm text-zinc-500">Manage school events and activities.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Event
        </button>
      </div>

      {showCreate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={onCreate} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" className={inputCls} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} className={inputCls} required />
            <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} className={inputCls}>
              <option value="general">General</option><option value="academic">Academic</option><option value="sports">Sports</option><option value="cultural">Cultural</option><option value="pta">PTA Meeting</option>
            </select>
          </div>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location (optional)" className={inputCls} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className={inputCls} />
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
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No events scheduled.</div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-zinc-900">{new Date(ev.event_date).getDate()}</p>
                  <p className="text-xs font-semibold uppercase text-zinc-500">{new Date(ev.event_date).toLocaleString("default", { month: "short" })}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">{ev.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{ev.location || "No location"} {ev.description ? `· ${ev.description.slice(0, 60)}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[ev.event_type] || TYPE_COLORS.general}`}>{ev.event_type}</span>
                <button onClick={() => deleteEvent(ev.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
