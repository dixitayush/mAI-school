"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { CalendarDays, Plus, Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

/** Mirrors the events.event_type CHECK constraint (migration 031). */
const EVENT_TYPES = [
  { value: "event", label: "General event" },
  { value: "holiday", label: "Holiday" },
  { value: "exam", label: "Exam" },
  { value: "meeting", label: "Staff meeting" },
  { value: "parent_meeting", label: "Parent meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "sports", label: "Sports" },
  { value: "cultural", label: "Cultural" },
  { value: "workshop", label: "Workshop" },
  { value: "other", label: "Other" },
];

/** Mirrors the events.visibility CHECK constraint. */
const VISIBILITIES = [
  { value: "all", label: "Everyone" },
  { value: "staff", label: "Staff only" },
  { value: "teachers", label: "Teachers" },
  { value: "students", label: "Students" },
  { value: "parents", label: "Parents" },
];

const TYPE_COLORS = {
  event: "bg-blue-100 text-blue-800",
  holiday: "bg-rose-100 text-rose-800",
  exam: "bg-primary-100 text-primary-800",
  meeting: "bg-zinc-100 text-zinc-700",
  parent_meeting: "bg-pink-100 text-pink-800",
  deadline: "bg-orange-100 text-orange-800",
  sports: "bg-amber-100 text-amber-800",
  cultural: "bg-violet-100 text-violet-800",
  workshop: "bg-sky-100 text-sky-800",
  other: "bg-zinc-100 text-zinc-700",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  event_type: "event",
  visibility: "all",
  location: "",
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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
    if (!form.title || !form.start_date) return toast.error("Title and date are required");
    setCreating(true);
    try {
      await apiFetch("/api/events", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description || null,
          event_type: form.event_type,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          all_day: !form.start_time,
          visibility: form.visibility,
          location: form.location || null,
        },
      });
      toast.success("Event created");
      setShowCreate(false);
      setForm(EMPTY_FORM);
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
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Start date</span>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">End date (optional)</span>
              <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Start time (optional)</span>
              <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">End time (optional)</span>
              <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Type</span>
              <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} className={inputCls}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Visible to</span>
              <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} className={inputCls}>
                {VISIBILITIES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </label>
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
                <div className="w-12 shrink-0 text-center">
                  <p className="text-2xl font-bold text-zinc-900">{new Date(ev.start_date).getDate()}</p>
                  <p className="text-xs font-semibold uppercase text-zinc-500">{new Date(ev.start_date).toLocaleString("default", { month: "short" })}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">{ev.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {ev.start_time ? `${ev.start_time.slice(0, 5)}${ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ""} · ` : "All day · "}
                    {ev.location || "No location"}
                    {ev.description ? ` · ${ev.description.slice(0, 60)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[ev.event_type] || TYPE_COLORS.other}`}>{String(ev.event_type).replace(/_/g, " ")}</span>
                <button onClick={() => deleteEvent(ev.id)} className="text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
