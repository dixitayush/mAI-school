"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CalendarDays, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ParentEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/events")
      .then((data) => setEvents(data.events || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const TYPE_COLORS = { general: "bg-blue-100 text-blue-800", academic: "bg-primary-100 text-primary-800", sports: "bg-amber-100 text-amber-800", cultural: "bg-violet-100 text-violet-800", pta: "bg-pink-100 text-pink-800" };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><CalendarDays className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">School Events</h1>
          <p className="text-sm text-zinc-500">Upcoming school events and activities.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No upcoming events.</div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-zinc-900">{new Date(ev.event_date).getDate()}</p>
                <p className="text-xs font-semibold uppercase text-zinc-500">{new Date(ev.event_date).toLocaleString("default", { month: "short" })}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{ev.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{ev.location || ""} {ev.description ? `· ${ev.description.slice(0, 80)}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[ev.event_type] || TYPE_COLORS.general}`}>{ev.event_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
