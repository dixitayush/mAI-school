"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Shield, Loader2, AlertTriangle, Lock, Key, Monitor } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SecurityCenterPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ failed_logins_24h: 0, active_sessions: 0, mfa_enabled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/audit?severity=warning&limit=20").catch(() => ({ logs: [] })),
      apiFetch("/api/audit/stats").catch(() => ({})),
    ]).then(([logData, statsData]) => {
      setLogs(logData.logs || []);
      setStats((s) => ({ ...s, ...statsData }));
    }).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Failed Logins (24h)", value: stats.failed_logins_24h ?? 0, icon: AlertTriangle, color: "bg-red-50 text-red-700" },
    { label: "Active Sessions", value: stats.active_sessions ?? 0, icon: Monitor, color: "bg-blue-50 text-blue-700" },
    { label: "MFA Enabled Users", value: stats.mfa_enabled ?? 0, icon: Key, color: "bg-emerald-50 text-emerald-700" },
  ];

  const SEVERITY = { info: "bg-blue-100 text-blue-800", warning: "bg-amber-100 text-amber-800", error: "bg-red-100 text-red-800", critical: "bg-red-200 text-red-900" };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Shield className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Security Center</h1>
          <p className="text-sm text-zinc-500">Monitor security events, sessions, and access patterns.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
                <p className="text-xs font-medium text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Recent Security Events</h2>
            </div>
            {logs.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400">No security events recorded.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-800">{log.action}</p>
                      <p className="text-xs text-zinc-500">{log.actor_name || log.user_name || "—"} · {log.ip_address || "—"} · {new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY[log.severity] || SEVERITY.info}`}>{log.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
