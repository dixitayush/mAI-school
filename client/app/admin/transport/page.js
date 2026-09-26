"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Bus, Plus, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function TransportPage() {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("vehicles");
  const [showAdd, setShowAdd] = useState(false);
  const [vForm, setVForm] = useState({ vehicle_number: "", capacity: "", driver_name: "", driver_phone: "" });
  const [rForm, setRForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vData, rData] = await Promise.all([apiFetch("/api/transport/vehicles"), apiFetch("/api/transport/routes")]);
      setVehicles(vData.vehicles || []);
      setRoutes(rData.routes || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addVehicle = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/transport/vehicles", { method: "POST", body: { ...vForm, capacity: Number(vForm.capacity) } });
      toast.success("Vehicle added");
      setShowAdd(false);
      setVForm({ vehicle_number: "", capacity: "", driver_name: "", driver_phone: "" });
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const addRoute = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/transport/routes", { method: "POST", body: rForm });
      toast.success("Route added");
      setShowAdd(false);
      setRForm({ name: "", description: "" });
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const tabCls = (t) => `rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-primary-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Bus className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Transport</h1><p className="text-sm text-zinc-500">Manage vehicles, routes, and student assignments.</p></div>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add {tab === "vehicles" ? "Vehicle" : "Route"}
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => { setTab("vehicles"); setShowAdd(false); }} className={tabCls("vehicles")}>Vehicles</button>
        <button onClick={() => { setTab("routes"); setShowAdd(false); }} className={tabCls("routes")}>Routes</button>
      </div>

      {showAdd && tab === "vehicles" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-zinc-900">Add Vehicle</h2><button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button></div>
          <form onSubmit={addVehicle} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Vehicle Number</label><input required value={vForm.vehicle_number} onChange={(e) => setVForm((f) => ({ ...f, vehicle_number: e.target.value }))} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Capacity</label><input type="number" min="1" required value={vForm.capacity} onChange={(e) => setVForm((f) => ({ ...f, capacity: e.target.value }))} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Driver Name</label><input value={vForm.driver_name} onChange={(e) => setVForm((f) => ({ ...f, driver_name: e.target.value }))} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Driver Phone</label><input value={vForm.driver_phone} onChange={(e) => setVForm((f) => ({ ...f, driver_phone: e.target.value }))} className={inputCls} /></div>
            <div className="sm:col-span-2"><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add</button></div>
          </form>
        </motion.div>
      )}

      {showAdd && tab === "routes" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-zinc-900">Add Route</h2><button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button></div>
          <form onSubmit={addRoute} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Route Name</label><input required value={rForm.name} onChange={(e) => setRForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Description</label><input value={rForm.description} onChange={(e) => setRForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
            <div className="sm:col-span-2"><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add</button></div>
          </form>
        </motion.div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
        ) : tab === "vehicles" ? (
          vehicles.length === 0 ? <div className="py-16 text-center text-sm text-zinc-400">No vehicles registered.</div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Number</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Phone</th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50"><td className="px-4 py-3 font-medium text-zinc-800">{v.vehicle_number}</td><td className="px-4 py-3 text-zinc-600">{v.capacity}</td><td className="px-4 py-3 text-zinc-600">{v.driver_name || "—"}</td><td className="px-4 py-3 text-zinc-500">{v.driver_phone || "—"}</td></tr>
                ))}
              </tbody>
            </table></div>
          )
        ) : (
          routes.length === 0 ? <div className="py-16 text-center text-sm text-zinc-400">No routes configured.</div> : (
            <div className="divide-y divide-zinc-100">
              {routes.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50">
                  <div><p className="text-sm font-semibold text-zinc-800">{r.name}</p><p className="text-xs text-zinc-500">{r.description || "—"}</p></div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{r.stop_count ?? r.stops_count ?? "—"} stops</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
