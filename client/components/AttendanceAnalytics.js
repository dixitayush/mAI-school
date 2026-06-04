"use client";

import { useQuery, gql } from "@apollo/client";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  CalendarRange,
  Percent,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const STUDENT_STATS = gql`
  query StudentStats($sid: UUID!) {
    studentAttendanceStats(pStudentId: $sid) {
      nodes {
        present
        absent
        late
        working
        attended
        percentage
      }
    }
    studentAttendanceMonthly(pStudentId: $sid, pMonths: 6) {
      nodes {
        month
        present
        total
        percentage
      }
    }
    allInstitutionSettings {
      nodes {
        attendanceThreshold
      }
    }
  }
`;

/**
 * Working-day-aware attendance analytics for a single student.
 * Uses server-side functions that account for holidays + weekends.
 */
export default function AttendanceAnalytics({ studentId }) {
  const { data, loading } = useQuery(STUDENT_STATS, {
    variables: { sid: studentId },
    skip: !studentId,
  });

  if (!studentId) return null;
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-100 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const stats = data?.studentAttendanceStats?.nodes?.[0] || {
    present: 0,
    absent: 0,
    late: 0,
    working: 0,
    attended: 0,
    percentage: 0,
  };
  const monthly = (data?.studentAttendanceMonthly?.nodes || []).map((m) => ({
    month: m.month,
    percentage: Number(m.percentage),
  }));
  const threshold = Number(data?.allInstitutionSettings?.nodes?.[0]?.attendanceThreshold ?? 75);
  const pct = Number(stats.percentage);
  const eligible = pct >= threshold;

  const cards = [
    { label: "Attendance", value: `${pct}%`, icon: Percent, cls: "bg-primary-100 text-primary-700" },
    { label: "Present (+late)", value: stats.attended, icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
    { label: "Working days", value: stats.working, icon: CalendarRange, cls: "bg-blue-100 text-blue-700" },
    { label: "Absent", value: stats.absent, icon: AlertTriangle, cls: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-zinc-500">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums text-zinc-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div
        className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium ${
          eligible
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}
      >
        {eligible ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        {eligible
          ? `Exam-eligible — attendance ${pct}% meets the ${threshold}% requirement.`
          : `Not exam-eligible — attendance ${pct}% is below the ${threshold}% requirement.`}
      </div>

      <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-4 text-base font-bold text-zinc-900">Monthly attendance trend</h3>
        {monthly.length > 0 ? (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="att" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" stroke="#9CA3AF" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="#9CA3AF" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="percentage" stroke="#4f46e5" fill="url(#att)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">No attendance data yet.</p>
        )}
      </div>
    </div>
  );
}
