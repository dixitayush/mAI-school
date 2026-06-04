"use client";

import { useQuery, gql } from "@apollo/client";
import { Loader2, AlertTriangle, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CLASS_SUMMARY = gql`
  query ClassSummary($cid: UUID!) {
    classAttendanceSummary(pClassId: $cid) {
      nodes {
        studentId
        fullName
        rollNumber
        present
        absent
        late
        working
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
 * Working-day-aware attendance summary for a whole class. Sorted lowest-first
 * (the SQL fn orders by percentage ASC) so low-attendance students surface.
 */
export default function ClassAttendanceSummary({ classId }) {
  const { data, loading } = useQuery(CLASS_SUMMARY, {
    variables: { cid: classId },
    skip: !classId,
  });

  if (!classId) {
    return (
      <div className="py-16 text-center text-zinc-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        Select a class to see attendance analytics.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const rows = data?.classAttendanceSummary?.nodes || [];
  const threshold = Number(
    data?.allInstitutionSettings?.nodes?.[0]?.attendanceThreshold ?? 75
  );
  const lowList = rows.filter((r) => Number(r.percentage) < threshold);
  const classAvg =
    rows.length > 0
      ? (
          rows.reduce((s, r) => s + Number(r.percentage), 0) / rows.length
        ).toFixed(1)
      : 0;

  const chartData = rows.map((r) => ({
    name: (r.fullName || "?").split(" ")[0],
    percentage: Number(r.percentage),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-100 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Students</p>
          <p className="text-2xl font-bold text-zinc-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Class average</p>
          <p className="text-2xl font-bold text-zinc-900">{classAvg}%</p>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Below {threshold}%</p>
          <p className="text-2xl font-bold text-red-600">{lowList.length}</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-zinc-100 bg-white p-4">
          <h3 className="mb-4 text-sm font-bold text-zinc-900">Per-student attendance %</h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" stroke="#9CA3AF" tickLine={false} axisLine={false} style={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} stroke="#9CA3AF" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.percentage >= threshold ? "#10B981" : "#EF4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Roll</th>
              <th className="p-3">Present</th>
              <th className="p-3">Absent</th>
              <th className="p-3">Late</th>
              <th className="p-3">Working</th>
              <th className="p-3">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = Number(r.percentage);
              const low = pct < threshold;
              return (
                <tr key={r.studentId} className={`border-t border-zinc-100 ${low ? "bg-red-50/40" : ""}`}>
                  <td className="p-3 font-medium text-zinc-800">{r.fullName}</td>
                  <td className="p-3 text-zinc-500">{r.rollNumber || "—"}</td>
                  <td className="p-3 text-green-700">{r.present}</td>
                  <td className="p-3 text-red-700">{r.absent}</td>
                  <td className="p-3 text-yellow-700">{r.late}</td>
                  <td className="p-3 text-zinc-600">{r.working}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${low ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {low && <AlertTriangle className="h-3 w-3" />}
                      {pct}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-400">
                  No attendance data for this class yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
