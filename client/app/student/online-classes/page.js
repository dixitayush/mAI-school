"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, gql } from "@apollo/client";
import { Video, Loader2, Clock, Calendar, ExternalLink, Users } from "lucide-react";
import { resolveSignInPath } from "@/lib/tenant";

const GET_STUDENT_CLASS = gql`
  query StudentClassForOnline($userId: UUID!) {
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

const GET_ONLINE_CLASSES = gql`
  query StudentOnlineClasses($classId: UUID!) {
    allOnlineClasses(condition: { classId: $classId }, orderBy: CLASS_DATE_ASC) {
      nodes {
        id
        title
        description
        classDate
        startTime
        endTime
        meetingLink
        provider
        section
        userByTeacherId {
          fullName
        }
      }
    }
  }
`;

const providerStyle = {
  zoom: "bg-blue-100 text-blue-700",
  meet: "bg-green-100 text-green-700",
  custom: "bg-zinc-100 text-zinc-600",
};

function StudentOnlineClassesContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    if (!storedUser || role !== "student") {
      router.push(resolveSignInPath());
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const { data: sData } = useQuery(GET_STUDENT_CLASS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });
  const classId = sData?.allStudents?.nodes?.[0]?.classId;
  const className = sData?.allStudents?.nodes?.[0]?.classByClassId?.name;

  const { data, loading } = useQuery(GET_ONLINE_CLASSES, {
    variables: { classId },
    skip: !classId,
    fetchPolicy: "cache-and-network",
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const { upcoming, past } = useMemo(() => {
    const all = data?.allOnlineClasses?.nodes || [];
    return {
      upcoming: all.filter((s) => s.classDate >= todayStr),
      past: all.filter((s) => s.classDate < todayStr).reverse(),
    };
  }, [data, todayStr]);

  if (!user) return null;

  const renderCard = (s) => {
    const isUpcoming = s.classDate >= todayStr;
    return (
      <div
        key={s.id}
        className={`rounded-2xl border bg-white p-4 ${isUpcoming ? "border-primary-100" : "border-zinc-100 opacity-80"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-zinc-900">{s.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${providerStyle[s.provider]}`}>
                {s.provider}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(`${s.classDate}T00:00:00`).toLocaleDateString()}
              </span>
              {(s.startTime || s.endTime) && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {s.startTime?.slice(0, 5)}
                  {s.endTime ? `–${s.endTime.slice(0, 5)}` : ""}
                </span>
              )}
              {s.userByTeacherId && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {s.userByTeacherId.fullName}
                </span>
              )}
            </div>
            {s.description && <p className="mt-2 text-sm text-zinc-600">{s.description}</p>}
          </div>
          {isUpcoming && (
            <a
              href={s.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Join
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <Video className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Online Classes</h1>
          <p className="text-sm text-zinc-500">{className ? `Class ${className}` : "Your live sessions"}</p>
        </div>
      </div>

      {!classId ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          You are not assigned to a class yet.
        </div>
      ) : loading && !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          No online classes scheduled.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Upcoming</h2>
              {upcoming.map(renderCard)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Past</h2>
              {past.map(renderCard)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StudentOnlineClassesPage() {
  return <StudentOnlineClassesContent />;
}
