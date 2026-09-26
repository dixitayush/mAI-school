"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Brain, Loader2, Sparkles, CalendarDays, BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function AIInsightsPage() {
  const [briefResult, setBriefResult] = useState(null);
  const [weeklyResult, setWeeklyResult] = useState(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  const generateBrief = async () => {
    setLoadingBrief(true);
    try {
      const data = await apiFetch("/api/ai/principal-brief", { method: "POST", body: {}, timeoutMs: 60000 });
      setBriefResult(data);
      toast.success("Brief generated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingBrief(false);
    }
  };

  const generateWeekly = async () => {
    setLoadingWeekly(true);
    try {
      const data = await apiFetch("/api/ai/weekly-report", { method: "POST", body: {}, timeoutMs: 60000 });
      setWeeklyResult(data);
      toast.success("Weekly report generated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingWeekly(false);
    }
  };

  const renderContent = (data) => {
    if (!data) return null;
    const text = data.brief || data.report || data.content || JSON.stringify(data, null, 2);
    return (
      <div className="mt-4 rounded-xl bg-zinc-50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
            <Sparkles className="h-3 w-3" /> AI Generated
          </span>
          <span className="text-xs text-zinc-400">{new Date().toLocaleString()}</span>
        </div>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-zinc-700">{text}</div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Insights</h1>
          <p className="text-sm text-zinc-500">AI-powered school intelligence and reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Daily Brief</h2>
              <p className="text-xs text-zinc-500">Overview of today&apos;s school status, metrics, and alerts.</p>
            </div>
          </div>
          <button
            onClick={generateBrief}
            disabled={loadingBrief}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loadingBrief ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Daily Brief
          </button>
          {renderContent(briefResult)}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Weekly Report</h2>
              <p className="text-xs text-zinc-500">Week-over-week trends, highlights, and recommendations.</p>
            </div>
          </div>
          <button
            onClick={generateWeekly}
            disabled={loadingWeekly}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loadingWeekly ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Weekly Report
          </button>
          {renderContent(weeklyResult)}
        </motion.div>
      </div>
    </div>
  );
}
