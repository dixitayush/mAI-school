"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Palette, Save, Loader2, Upload, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function BrandingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    primary_color: "#6fa371",
    secondary_color: "#3b82f6",
    favicon_url: "",
    email_logo_url: "",
    login_background_url: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    website: "",
    timezone: "Asia/Kolkata",
    locale: "en-IN",
    currency: "INR",
    date_format: "DD/MM/YYYY",
  });

  useEffect(() => {
    apiFetch("/api/branding")
      .then((data) => {
        if (data.branding) {
          setForm((f) => ({
            ...f,
            ...Object.fromEntries(Object.entries(data.branding).filter(([, v]) => v != null)),
          }));
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/branding", { method: "PATCH", body: form });
      toast.success("Branding updated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

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
          <Palette className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Branding</h1>
          <p className="text-sm text-zinc-500">Customize your institution&apos;s look and contact info.</p>
        </div>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSave}
        className="space-y-6"
      >
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Colors</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Primary color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={set("primary_color")}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-300"
                />
                <input type="text" value={form.primary_color} onChange={set("primary_color")} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Secondary color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={set("secondary_color")}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-300"
                />
                <input type="text" value={form.secondary_color} onChange={set("secondary_color")} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-zinc-50 p-4">
            <p className="mb-2 text-xs font-medium text-zinc-500">Preview</p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl" style={{ backgroundColor: form.primary_color }} />
              <div className="h-10 w-10 rounded-xl" style={{ backgroundColor: form.secondary_color }} />
              <div className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: form.primary_color }}>
                Button
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Assets</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Favicon URL</label>
              <input type="url" value={form.favicon_url} onChange={set("favicon_url")} className={inputCls} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Email logo URL</label>
              <input type="url" value={form.email_logo_url} onChange={set("email_logo_url")} className={inputCls} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Login background URL</label>
              <input type="url" value={form.login_background_url} onChange={set("login_background_url")} className={inputCls} placeholder="https://..." />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Contact Info</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Email</label>
              <input type="email" value={form.contact_email} onChange={set("contact_email")} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Phone</label>
              <input type="tel" value={form.contact_phone} onChange={set("contact_phone")} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Address</label>
              <textarea value={form.address} onChange={set("address")} rows={2} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Website</label>
              <input type="url" value={form.website} onChange={set("website")} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Locale</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Timezone</label>
              <select value={form.timezone} onChange={set("timezone")} className={inputCls}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Currency</label>
              <select value={form.currency} onChange={set("currency")} className={inputCls}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Date format</label>
              <select value={form.date_format} onChange={set("date_format")} className={inputCls}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save branding
        </button>
      </motion.form>
    </div>
  );
}
