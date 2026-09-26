"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Package, Plus, Loader2, X, Wrench } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  available: "bg-emerald-100 text-emerald-800",
  in_use: "bg-blue-100 text-blue-800",
  maintenance: "bg-amber-100 text-amber-800",
  retired: "bg-zinc-100 text-zinc-600",
};

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", location: "", quantity: 1, status: "available" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemData, statsData] = await Promise.all([apiFetch("/api/inventory"), apiFetch("/api/inventory/stats")]);
      setItems(itemData.items || []);
      setStats(statsData.stats || {});
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/inventory", { method: "POST", body: { ...form, quantity: Number(form.quantity) } });
      toast.success("Item added");
      setShowAdd(false);
      setForm({ name: "", category: "", location: "", quantity: 1, status: "available" });
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const logMaintenance = async (id) => {
    const note = prompt("Maintenance note:");
    if (!note) return;
    try {
      await apiFetch(`/api/inventory/${id}/maintenance`, { method: "POST", body: { notes: note } });
      toast.success("Maintenance logged");
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Package className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Inventory</h1><p className="text-sm text-zinc-500">Track school assets and equipment.</p></div>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"><Plus className="h-4 w-4" /> Add Item</button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-zinc-900">{stats.total || 0}</p><p className="text-xs font-medium text-zinc-500">Total Items</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-blue-600">{stats.in_use || 0}</p><p className="text-xs font-medium text-zinc-500">In Use</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-emerald-600">{stats.available || 0}</p><p className="text-xs font-medium text-zinc-500">Available</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-amber-600">{stats.maintenance || 0}</p><p className="text-xs font-medium text-zinc-500">Maintenance</p></div>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-zinc-900">Add Item</h2><button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button></div>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Name</label><input required value={form.name} onChange={set("name")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Category</label><input value={form.category} onChange={set("category")} className={inputCls} placeholder="e.g. Furniture, Electronics" /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Location</label><input value={form.location} onChange={set("location")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Quantity</label><input type="number" min="1" value={form.quantity} onChange={set("quantity")} className={inputCls} /></div>
            <div className="sm:col-span-2"><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add</button></div>
          </form>
        </motion.div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">No inventory items.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-800">{it.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{it.category || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{it.location || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{it.quantity}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[it.status] || "bg-zinc-100 text-zinc-700"}`}>{it.status?.replace("_", " ")}</span></td>
                  <td className="px-4 py-3"><button onClick={() => logMaintenance(it.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600"><Wrench className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
