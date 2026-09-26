"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, Loader2, Check, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const data = await apiFetch("/api/notifications/unread-count");
      setUnread(data.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/notifications?limit=15");
      setNotifications(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {}
    finally { setLoading(false); }
  };

  const toggle = () => {
    if (!open) fetchNotifications();
    setOpen((o) => !o);
  };

  const markRead = async (id) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnread((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {}
  };

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const ICON_COLORS = {
    attendance: "bg-blue-50 text-blue-600",
    fees: "bg-amber-50 text-amber-600",
    exam: "bg-violet-50 text-violet-600",
    announcement: "bg-primary-50 text-primary-600",
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle}
        className="relative flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100"
        aria-label="Notifications">
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <button key={n.id} onClick={() => !n.read && markRead(n.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 ${!n.read ? "bg-primary-50/30" : ""}`}>
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_COLORS[n.category] || "bg-zinc-50 text-zinc-500"}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.read ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>{n.title || n.message}</p>
                    {n.body && <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-zinc-400">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
                  </div>
                  {!n.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
