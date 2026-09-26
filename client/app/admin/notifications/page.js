"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Bell, Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const CATEGORIES = [
  { key: "attendance", label: "Attendance", desc: "Daily attendance alerts and absence notifications." },
  { key: "fees", label: "Fees & Payments", desc: "Fee reminders, payment confirmations, and overdue alerts." },
  { key: "exams", label: "Exams & Results", desc: "Exam schedules, report cards, and grade updates." },
  { key: "announcements", label: "Announcements", desc: "School-wide announcements and circulars." },
  { key: "leave", label: "Leave & Approvals", desc: "Leave requests, approvals, and workflow updates." },
  { key: "system", label: "System", desc: "Account security, password changes, and login alerts." },
];

const CHANNELS = ["email", "push", "sms"];

export default function NotificationPrefsPage() {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/notifications/preferences")
      .then((data) => {
        const map = {};
        (data.preferences || []).forEach((p) => {
          map[p.category] = { email: p.email ?? true, push: p.push ?? true, sms: p.sms ?? false };
        });
        CATEGORIES.forEach((c) => {
          if (!map[c.key]) map[c.key] = { email: true, push: true, sms: false };
        });
        setPrefs(map);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (category, channel) => {
    setPrefs((p) => ({
      ...p,
      [category]: { ...p[category], [channel]: !p[category]?.[channel] },
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/notifications/preferences", {
        method: "PUT",
        body: { preferences: Object.entries(prefs).map(([category, channels]) => ({ category, ...channels })) },
      });
      toast.success("Notification preferences saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Notification Preferences</h1>
          <p className="text-sm text-zinc-500">Choose how you want to be notified.</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="hidden border-b border-zinc-100 bg-zinc-50 px-5 py-3 sm:grid sm:grid-cols-[1fr_80px_80px_80px] sm:gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Category</span>
            {CHANNELS.map((ch) => (
              <span key={ch} className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {ch}
              </span>
            ))}
          </div>

          <div className="divide-y divide-zinc-100">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1fr_80px_80px_80px] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{cat.label}</p>
                  <p className="text-xs text-zinc-500">{cat.desc}</p>
                </div>
                {CHANNELS.map((ch) => (
                  <div key={ch} className="flex items-center gap-2 sm:justify-center">
                    <span className="text-xs text-zinc-400 sm:hidden">{ch}</span>
                    <button
                      type="button"
                      onClick={() => toggle(cat.key, ch)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        prefs[cat.key]?.[ch] ? "bg-primary-600" : "bg-zinc-300"
                      }`}
                      aria-pressed={!!prefs[cat.key]?.[ch]}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          prefs[cat.key]?.[ch] ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save preferences
        </button>
      </motion.div>
    </div>
  );
}
