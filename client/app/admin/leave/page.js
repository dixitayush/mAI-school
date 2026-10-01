"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { CalendarOff, Check, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function LeavePage() {
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("requests");
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const [reqData, typeData] = await Promise.all([
        apiFetch(`/api/leave/requests?${params}`),
        apiFetch("/api/leave/types"),
      ]);
      setRequests(reqData.requests || []);
      setTypes(typeData.leave_types || typeData.types || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (id, status) => {
    try {
      await apiFetch(`/api/leave/requests/${id}`, { method: "PATCH", body: { status } });
      toast.success(`Leave ${status}`);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const tabCls = (t) => `rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-primary-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><CalendarOff className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Leave Management</h1><p className="text-sm text-zinc-500">Review and manage staff leave requests.</p></div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setTab("requests")} className={tabCls("requests")}>Requests</button>
        <button onClick={() => setTab("types")} className={tabCls("types")}>Leave Types</button>
        <div className="ml-auto">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
            <option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {tab === "types" ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {types.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">No leave types configured.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {types.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.description || "—"}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{t.days_allowed ?? "—"} days/year</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">No leave requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Staff</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-800">{r.staff_name || r.user_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{r.leave_type || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{r.start_date ? new Date(r.start_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{r.end_date ? new Date(r.end_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[r.status] || "bg-zinc-100 text-zinc-700"}`}>{r.status}</span></td>
                      <td className="px-4 py-3">
                        {r.status === "pending" ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleAction(r.id, "approved")} className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"><Check className="h-4 w-4" /></button>
                            <button onClick={() => handleAction(r.id, "rejected")} className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><X className="h-4 w-4" /></button>
                          </div>
                        ) : <span className="text-xs text-zinc-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
