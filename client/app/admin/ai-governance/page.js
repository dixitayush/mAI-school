"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Brain, Loader2, DollarSign, Zap, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function AIGovernancePage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/ai/usage")
      .then((data) => setUsage(data.stats || data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Brain className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Cost Governance</h1>
          <p className="text-sm text-zinc-500">Monitor AI usage, costs, and set spending limits.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : !usage ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No AI usage data available yet.</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Zap className="h-5 w-5" /></div>
              <p className="text-2xl font-bold text-zinc-900">{usage.total_requests ?? 0}</p>
              <p className="text-xs font-medium text-zinc-500">Total Requests</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><DollarSign className="h-5 w-5" /></div>
              <p className="text-2xl font-bold text-zinc-900">${((usage.total_cost ?? 0) / 100).toFixed(2)}</p>
              <p className="text-xs font-medium text-zinc-500">Total Cost</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><TrendingUp className="h-5 w-5" /></div>
              <p className="text-2xl font-bold text-zinc-900">{usage.total_tokens ? (usage.total_tokens / 1000).toFixed(1) + "k" : "0"}</p>
              <p className="text-xs font-medium text-zinc-500">Total Tokens</p>
            </div>
          </div>

          {usage.by_feature && Object.keys(usage.by_feature).length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4"><h2 className="text-lg font-semibold text-zinc-900">Usage by Feature</h2></div>
              <div className="divide-y divide-zinc-100">
                {Object.entries(usage.by_feature).map(([feature, data]) => (
                  <div key={feature} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium capitalize text-zinc-800">{feature.replace(/_/g, " ")}</p>
                      <p className="text-xs text-zinc-500">{data.count || 0} requests</p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">${((data.cost || 0) / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usage.daily && usage.daily.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4"><h2 className="text-lg font-semibold text-zinc-900">Daily Usage (Last 7 Days)</h2></div>
              <div className="divide-y divide-zinc-100">
                {usage.daily.slice(0, 7).map((day) => (
                  <div key={day.date} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-medium text-zinc-800">{new Date(day.date).toLocaleDateString()}</p>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900">{day.requests || 0} requests</p>
                      <p className="text-xs text-zinc-500">${((day.cost || 0) / 100).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
