"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Package, Plus, Loader2, X, Wrench } from "lucide-react";
import { apiFetch } from "@/lib/api";

/** Mirrors the assets.status CHECK constraint (migration 035). */
const STATUSES = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "under_repair", label: "Under repair" },
  { value: "disposed", label: "Disposed" },
];

/** Mirrors the assets.category CHECK constraint (migration 035). */
const CATEGORIES = [
  { value: "computer", label: "Computer" },
  { value: "projector", label: "Projector" },
  { value: "furniture", label: "Furniture" },
  { value: "lab_equipment", label: "Lab equipment" },
  { value: "sports_equipment", label: "Sports equipment" },
  { value: "stationery", label: "Stationery" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
];

const MAINTENANCE_TYPES = [
  { value: "repair", label: "Repair" },
  { value: "service", label: "Service" },
  { value: "inspection", label: "Inspection" },
  { value: "replacement", label: "Replacement" },
];

const STATUS_COLORS = {
  available: "bg-emerald-100 text-emerald-800",
  assigned: "bg-blue-100 text-blue-800",
  under_repair: "bg-amber-100 text-amber-800",
  disposed: "bg-zinc-100 text-zinc-600",
};

const EMPTY_FORM = {
  name: "",
  asset_code: "",
  category: "other",
  location: "",
  status: "available",
  purchase_cost: "",
  purchase_date: "",
  warranty_expiry: "",
  description: "",
};

const EMPTY_MAINT = { type: "repair", description: "", cost: "", performed_by: "", performed_at: "" };

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [maintFor, setMaintFor] = useState(null);
  const [maint, setMaint] = useState(EMPTY_MAINT);
  const [filters, setFilters] = useState({ category: "", status: "", search: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      ).toString();
      const [assetData, statsData] = await Promise.all([
        apiFetch(`/api/inventory${qs ? `?${qs}` : ""}`),
        apiFetch("/api/inventory/stats"),
      ]);
      setItems(assetData.assets || []);
      setStats(statsData.stats || {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/inventory", {
        method: "POST",
        body: {
          name: form.name,
          asset_code: form.asset_code || null,
          category: form.category,
          location: form.location || null,
          status: form.status,
          description: form.description || null,
          purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
          purchase_date: form.purchase_date || null,
          warranty_expiry: form.warranty_expiry || null,
        },
      });
      toast.success("Asset added");
      setShowAdd(false);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitMaintenance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/inventory/${maintFor.id}/maintenance`, {
        method: "POST",
        body: {
          type: maint.type,
          description: maint.description || null,
          cost: maint.cost ? Number(maint.cost) : null,
          performed_by: maint.performed_by || null,
          performed_at: maint.performed_at || null,
        },
      });
      toast.success("Maintenance logged");
      setMaintFor(null);
      setMaint(EMPTY_MAINT);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (asset, status) => {
    try {
      await apiFetch(`/api/inventory/${asset.id}`, { method: "PATCH", body: { status } });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setM = (k) => (e) => setMaint((f) => ({ ...f, [k]: e.target.value }));
  const inputCls =
    "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Inventory</h1>
            <p className="text-sm text-zinc-500">Track school assets, assignments and maintenance.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Add Asset
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat value={stats.total || 0} label="Total Assets" tone="text-zinc-900" />
        <Stat value={stats.available || 0} label="Available" tone="text-emerald-600" />
        <Stat value={stats.assigned || 0} label="Assigned" tone="text-blue-600" />
        <Stat value={stats.under_repair || 0} label="Under Repair" tone="text-amber-600" />
        <Stat
          value={`₹${Number(stats.total_value || 0).toLocaleString("en-IN")}`}
          label="Purchase Value"
          tone="text-zinc-900"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search name or code…"
          className="w-56 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Add Asset</h2>
            <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input required value={form.name} onChange={set("name")} className={inputCls} />
            </Field>
            <Field label="Asset code">
              <input value={form.asset_code} onChange={set("asset_code")} className={inputCls} placeholder="e.g. PC-014" />
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={set("category")} className={inputCls}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set("status")} className={inputCls}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input value={form.location} onChange={set("location")} className={inputCls} placeholder="e.g. Lab 2" />
            </Field>
            <Field label="Purchase cost (₹)">
              <input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={set("purchase_cost")} className={inputCls} />
            </Field>
            <Field label="Purchase date">
              <input type="date" value={form.purchase_date} onChange={set("purchase_date")} className={inputCls} />
            </Field>
            <Field label="Warranty expiry">
              <input type="date" value={form.warranty_expiry} onChange={set("warranty_expiry")} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <input value={form.description} onChange={set("description")} className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {maintFor && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Log maintenance — {maintFor.name}</h2>
            <button onClick={() => setMaintFor(null)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={submitMaintenance} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select value={maint.type} onChange={setM("type")} className={inputCls}>
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Performed by">
              <input value={maint.performed_by} onChange={setM("performed_by")} className={inputCls} />
            </Field>
            <Field label="Cost (₹)">
              <input type="number" min="0" step="0.01" value={maint.cost} onChange={setM("cost")} className={inputCls} />
            </Field>
            <Field label="Performed on">
              <input type="date" value={maint.performed_at} onChange={setM("performed_at")} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <input value={maint.description} onChange={setM("description")} className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save record
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">No inventory items.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((it) => (
                  <tr key={it.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{it.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{it.asset_code || "—"}</td>
                    <td className="px-4 py-3 capitalize text-zinc-600">
                      {(it.category || "—").replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{it.location || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{it.assigned_to_name || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={it.status}
                        onChange={(e) => changeStatus(it, e.target.value)}
                        className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold capitalize outline-none ${
                          STATUS_COLORS[it.status] || "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setMaintFor(it);
                          setMaint(EMPTY_MAINT);
                        }}
                        title="Log maintenance"
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        <Wrench className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}
