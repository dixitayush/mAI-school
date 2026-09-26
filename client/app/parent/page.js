"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Users, Loader2, ChevronRight, CheckCircle, AlertTriangle, DollarSign, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useTenantPaths } from "@/lib/useTenantPaths";

export default function ParentDashboard() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChild, setActiveChild] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const { to } = useTenantPaths();

  useEffect(() => {
    apiFetch("/api/parents/children")
      .then((data) => {
        setChildren(data.children || []);
        if (data.children?.length > 0) setActiveChild(data.children[0]);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeChild) return;
    setDashLoading(true);
    apiFetch(`/api/parents/dashboard/${activeChild.id}`)
      .then((data) => setDashboard(data))
      .catch((err) => toast.error(err.message))
      .finally(() => setDashLoading(false));
  }, [activeChild]);

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-24 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>;
  }

  if (children.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <Users className="mx-auto h-12 w-12 text-zinc-300" />
        <h2 className="mt-4 text-lg font-semibold text-zinc-700">No Children Linked</h2>
        <p className="mt-1 text-sm text-zinc-500">Your account hasn't been linked to any students yet. Please contact the school admin.</p>
      </div>
    );
  }

  const att = dashboard?.attendance;
  const stats = [
    { label: "Attendance", value: att?.percentage != null ? `${att.percentage}%` : "—", icon: CheckCircle, color: "bg-emerald-50 text-emerald-700" },
    { label: "Present", value: att?.present ?? "—", icon: CheckCircle, color: "bg-blue-50 text-blue-700" },
    { label: "Absent", value: att?.absent ?? "—", icon: AlertTriangle, color: "bg-red-50 text-red-700" },
    { label: "Pending Fees", value: dashboard?.pending_fees?.length ?? 0, icon: DollarSign, color: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Users className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Parent Dashboard</h1>
          <p className="text-sm text-zinc-500">Monitor your children's progress and school updates.</p>
        </div>
      </div>

      {children.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {children.map((child) => (
            <button key={child.id} onClick={() => setActiveChild(child)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeChild?.id === child.id ? "bg-primary-600 text-white shadow-sm" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"}`}>
              {child.full_name}
            </button>
          ))}
        </div>
      )}

      {activeChild && (
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{activeChild.full_name}</h2>
          <p className="text-sm text-zinc-500">
            Class {activeChild.class_name || "—"} {activeChild.section ? `· Section ${activeChild.section}` : ""} · Roll #{activeChild.roll_number || "—"}
          </p>
        </div>
      )}

      {dashLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading dashboard...</div>
      ) : dashboard ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <p className="text-2xl font-bold text-zinc-900">{s.value}</p>
                <p className="text-xs font-medium text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>

          {dashboard.pending_fees?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4"><h3 className="font-semibold text-zinc-900">Pending Fees</h3></div>
              <div className="divide-y divide-zinc-100">
                {dashboard.pending_fees.map((fee) => (
                  <div key={fee.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{fee.description}</p>
                      <p className="text-xs text-zinc-500">Due: {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : "—"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${fee.status === "overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                      ₹{Number(fee.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.recent_results?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4"><h3 className="font-semibold text-zinc-900">Recent Exam Results</h3></div>
              <div className="divide-y divide-zinc-100">
                {dashboard.recent_results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{r.title}</p>
                      <p className="text-xs text-zinc-500">{r.subject} · {r.exam_date ? new Date(r.exam_date).toLocaleDateString() : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900">{r.marks_obtained}/{r.total_marks}</p>
                      {r.grade && <p className="text-xs text-zinc-500">Grade: {r.grade}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.assignments?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4"><h3 className="font-semibold text-zinc-900">Assignments</h3></div>
              <div className="divide-y divide-zinc-100">
                {dashboard.assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{a.title}</p>
                      <p className="text-xs text-zinc-500">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.submission_status === "submitted" ? "bg-emerald-100 text-emerald-800" : a.submission_status === "graded" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-600"}`}>
                      {a.submission_status || "pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.announcements?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4"><h3 className="font-semibold text-zinc-900">School Announcements</h3></div>
              <div className="divide-y divide-zinc-100">
                {dashboard.announcements.map((a) => (
                  <div key={a.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-zinc-800">{a.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{a.content?.slice(0, 120)}</p>
                    <p className="mt-1 text-[10px] text-zinc-400">{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ) : null}
    </div>
  );
}
