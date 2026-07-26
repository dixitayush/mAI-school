"use client";

import { useMemo, useState } from "react";
import { useQuery, gql } from "@apollo/client";
import { CalendarClock, Loader2, Clock, MapPin, User, PartyPopper } from "lucide-react";
import { useRequireRole } from "@/lib/useSession";

const GET_STUDENT_CLASS = gql`
  query StudentClass($userId: UUID!) {
    allStudents(condition: { userId: $userId }) {
      nodes {
        id
        classId
        classByClassId {
          name
        }
      }
    }
  }
`;

const GET_TIMETABLE = gql`
  query StudentTimetable($classId: UUID!) {
    allTimetablePeriods(condition: { classId: $classId }, orderBy: PERIOD_NO_ASC) {
      nodes {
        id
        dayOfWeek
        periodNo
        subject
        startTime
        endTime
        room
        userByTeacherId {
          fullName
        }
      }
    }
    allHolidays {
      nodes {
        id
        title
        startDate
        endDate
        type
      }
    }
  }
`;

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function StudentTimetableContent() {
  const { user, ready } = useRequireRole(["student", "admin"]);
  const [dateStr, setDateStr] = useState(toISO(new Date()));

  const { data: sData } = useQuery(GET_STUDENT_CLASS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });
  const classId = sData?.allStudents?.nodes?.[0]?.classId;
  const className = sData?.allStudents?.nodes?.[0]?.classByClassId?.name;

  const { data, loading } = useQuery(GET_TIMETABLE, {
    variables: { classId },
    skip: !classId,
  });

  const selected = useMemo(() => new Date(`${dateStr}T00:00:00`), [dateStr]);
  const dow = selected.getDay();
  const periods = (data?.allTimetablePeriods?.nodes || [])
    .filter((p) => p.dayOfWeek === dow)
    .sort((a, b) => a.periodNo - b.periodNo);
  const holiday = (data?.allHolidays?.nodes || []).find(
    (h) => dateStr >= h.startDate && dateStr <= h.endDate
  );

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My Timetable</h1>
          <p className="text-sm text-zinc-500">{className ? `Class ${className}` : "Your class schedule"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Date</label>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <span className="pb-2.5 text-sm font-medium text-zinc-600">{DOW[dow]}</span>
      </div>

      {!classId ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          You are not assigned to a class yet.
        </div>
      ) : loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : holiday ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 py-14 text-center">
          <PartyPopper className="h-8 w-8 text-amber-500" />
          <p className="text-lg font-bold text-amber-800">{holiday.title}</p>
          <p className="text-sm text-amber-600">Holiday — no classes scheduled.</p>
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          No periods scheduled for {DOW[dow]}.
        </div>
      ) : (
        <div className="space-y-2">
          {periods.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white p-4"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700">
                {p.periodNo}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{p.subject}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  {(p.startTime || p.endTime) && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {p.startTime?.slice(0, 5)}
                      {p.endTime ? `–${p.endTime.slice(0, 5)}` : ""}
                    </span>
                  )}
                  {p.userByTeacherId && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {p.userByTeacherId.fullName}
                    </span>
                  )}
                  {p.room && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {p.room}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentTimetablePage() {
  return <StudentTimetableContent />;
}
