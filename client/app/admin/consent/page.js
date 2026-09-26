"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ShieldCheck, Plus, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ConsentPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", required: false });

  const fetchTypes = async () => {
    try {
      const data = await apiFetch("/api/consent/types");
      setTypes(data.types || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTypes(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error("Name is required");
    setCreating(true);
    try {
      await apiFetch("/api/consent/types", { method: "POST", body: form });
      toast.success("Consent type created");
      setShowCreate(false);
      setForm({ name: "", description: "", required: false });
      fetchTypes();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Consent Management</h1>
            <p className="text-sm text-zinc-500">Manage parental consent types and records.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Type
        </button>
      </div>

      {showCreate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={onCreate} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Consent type name (e.g. Field Trip, Photo Release)" className={inputCls} required />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className={inputCls} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(f => ({ ...f, required: !f.required }))} className={`relative h-6 w-11 rounded-full transition ${form.required ? "bg-primary-600" : "bg-zinc-300"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.required ? "left-[22px]" : "left-0.5"}`} />
            </button>
            <span className="text-sm text-zinc-700">Required consent</span>
          </div>
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
      ) : types.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No consent types defined yet.</div>
      ) : (
        <div className="space-y-3">
          {types.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <p className="font-semibold text-zinc-900">{t.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{t.description || "No description"}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.required ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"}`}>
                {t.required ? "Required" : "Optional"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
