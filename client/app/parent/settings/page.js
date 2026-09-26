"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Settings, Loader2, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ParentSettingsPage() {
  const [prefs, setPrefs] = useState({ weekly_digest_enabled: true, digest_day: "monday" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/parents/digest-preferences")
      .then((data) => { if (data) setPrefs(p => ({ ...p, ...data })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/parents/digest-preferences", { method: "PATCH", body: prefs });
      toast.success("Preferences saved");
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700"><Settings className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Settings</h1>
          <p className="text-sm text-zinc-500">Manage your notification and digest preferences.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-zinc-900">Weekly Digest Email</p>
              <p className="text-xs text-zinc-500">Receive a weekly summary of your child's progress.</p>
            </div>
            <button onClick={() => setPrefs(p => ({ ...p, weekly_digest_enabled: !p.weekly_digest_enabled }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${prefs.weekly_digest_enabled ? "bg-primary-600" : "bg-zinc-200"}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${prefs.weekly_digest_enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {prefs.weekly_digest_enabled && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Digest Day</label>
              <select value={prefs.digest_day} onChange={(e) => setPrefs(p => ({ ...p, digest_day: e.target.value }))} className={inputCls}>
                <option value="monday">Monday</option>
                <option value="friday">Friday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          )}

          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Preferences
          </button>
        </div>
      )}
    </div>
  );
}
