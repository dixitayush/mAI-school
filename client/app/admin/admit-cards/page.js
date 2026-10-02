"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, gql } from "@apollo/client";
import { toast } from "react-hot-toast";
import {
  IdCard,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Layers,
  Search,
} from "lucide-react";
import { apiFetch, fetchFileDataUrl } from "@/lib/api";
import StudentId from "@/components/StudentId";
import { generateAdmitCard, generateAdmitCardsBulk } from "@/lib/generateAdmitCard";

const GET_ELIGIBILITY = gql`
  query AdmitEligibility($examId: UUID!) {
    admitEligibilityForExam(pExamId: $examId) {
      nodes {
        studentId
        registrationId
        fullName
        rollNumber
        photoFileId
        attendancePct
        threshold
        attendanceOk
        pendingFees
        feeGate
        feeOk
        eligible
        reason
      }
    }
  }
`;

const selectCls =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400";

const formatDate = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function AdmitCardsPage() {
  // Narrowed session → class → exam. Loaded fresh rather than through the
  // shared filter-options cache, which is not refreshed when an exam is created.
  const [options, setOptions] = useState({ sessions: [], classes: [], exams: [] });
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch("/api/academics/filter-options")
      .then((d) => {
        setOptions({ sessions: d.sessions || [], classes: d.classes || [], exams: d.exams || [] });
        setSessionId((cur) => cur || d.current_session_id || "");
      })
      .catch((err) => toast.error(err.message));
  }, []);

  // Exams in the chosen session ("" = every session).
  const sessionExams = useMemo(
    () => options.exams.filter((e) => !sessionId || e.session_id === sessionId),
    [options.exams, sessionId]
  );
  // Only classes that actually have an exam in the session are worth offering.
  const classesWithExams = useMemo(() => {
    const counts = {};
    for (const e of sessionExams) counts[e.class_id] = (counts[e.class_id] || 0) + 1;
    return options.classes
      .filter((c) => counts[c.id])
      .map((c) => ({ ...c, examCount: counts[c.id] }));
  }, [options.classes, sessionExams]);
  const exams = useMemo(
    () => sessionExams.filter((e) => !classId || e.class_id === classId),
    [sessionExams, classId]
  );
  const selectedExam = options.exams.find((e) => e.id === examId);

  // Narrowing a level clears the choices below it; a single remaining exam is
  // picked automatically.
  const chooseSession = (id) => {
    setSessionId(id);
    setClassId("");
    setExamId("");
    setSearch("");
  };
  const chooseClass = (id) => {
    setClassId(id);
    const matching = sessionExams.filter((e) => !id || e.class_id === id);
    setExamId(id && matching.length === 1 ? matching[0].id : "");
    setSearch("");
  };
  const chooseExam = (id) => {
    setExamId(id);
    setSearch("");
  };

  const { data, loading } = useQuery(GET_ELIGIBILITY, {
    variables: { examId },
    skip: !examId,
  });
  const allRows = data?.admitEligibilityForExam?.nodes || [];
  const eligible = allRows.filter((r) => r.eligible);
  const rows = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => {
      const name = (r.fullName || "").toLowerCase();
      const roll = (r.rollNumber || "").toLowerCase();
      const regId = (r.registrationId || "").toLowerCase();
      return name.includes(q) || roll.includes(q) || regId.includes(q);
    });
  })();

  const schoolBrand = (() => {
    try {
      const inst = JSON.parse(localStorage.getItem("institution") || "null");
      return { schoolName: inst?.name, schoolSlug: inst?.slug };
    } catch {
      return {};
    }
  })();

  const buildCard = async (r) => ({
    ...schoolBrand,
    examTitle: selectedExam?.title,
    subject: selectedExam?.subject,
    examDate: selectedExam?.exam_date,
    studentName: r.fullName,
    registrationId: r.registrationId,
    rollNumber: r.rollNumber,
    className: selectedExam?.class_name,
    section: r.section,
    photoDataUrl: r.photoFileId ? await fetchFileDataUrl(r.photoFileId) : null,
  });

  const handleSingle = async (r) => {
    if (!r.eligible) return toast.error("Student is not eligible");
    try {
      generateAdmitCard(await buildCard(r));
    } catch (err) {
      toast.error(err.message || "Failed to generate");
    }
  };

  const handleBulk = async () => {
    if (eligible.length === 0) return toast.error("No eligible students");
    setBulkBusy(true);
    try {
      const cards = [];
      for (const r of eligible) cards.push(await buildCard(r));
      generateAdmitCardsBulk(cards, `admit-cards-${selectedExam?.title || "exam"}`);
      toast.success(`Generated ${cards.length} admit cards`);
    } catch (err) {
      toast.error(err.message || "Bulk generation failed");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <IdCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Exam Admit Cards</h1>
          <p className="text-sm text-zinc-500">
            Generated only for students who meet attendance and fee requirements.
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">1. Session</label>
          <select value={sessionId} onChange={(e) => chooseSession(e.target.value)} className={selectCls}>
            <option value="">All sessions</option>
            {options.sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">2. Class</label>
          <select value={classId} onChange={(e) => chooseClass(e.target.value)} className={selectCls} disabled={classesWithExams.length === 0}>
            <option value="">{classesWithExams.length === 0 ? "No exams in this session" : "All classes"}</option>
            {classesWithExams.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.examCount} exam{c.examCount === 1 ? "" : "s"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">3. Exam</label>
          <select value={examId} onChange={(e) => chooseExam(e.target.value)} className={selectCls} disabled={exams.length === 0}>
            <option value="">{exams.length === 0 ? "No exams" : `Select exam (${exams.length})…`}</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.subject}{classId ? "" : ` · ${e.class_name}`} · {formatDate(e.exam_date)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {examId && (
          <>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 min-w-[220px]">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name, registration ID or roll…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-700 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleBulk}
              disabled={bulkBusy || eligible.length === 0}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Generate all eligible ({eligible.length})
            </button>
          </>
        )}
      </div>

      {!examId ? (
        <div className="rounded-xl border border-zinc-100 bg-white py-16 text-center text-zinc-500">
          {exams.length === 0
            ? "No exams scheduled for this session and class. Pick another session or class."
            : "Choose a session, class and exam to view eligibility."}
        </div>
      ) : loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">Attendance</th>
                <th className="p-3">Fees</th>
                <th className="p-3">Status</th>
                <th className="p-3">Admit Card</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className={`border-t border-zinc-100 ${r.eligible ? "" : "bg-red-50/40"}`}>
                  <td className="p-3">
                    <p className="font-medium text-zinc-800">{r.fullName}</p>
                    <p className="text-xs text-zinc-400">
                      <StudentId value={r.registrationId} plain className="font-semibold text-indigo-600" />
                      {r.rollNumber && ` · Roll ${r.rollNumber}`}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className={r.attendanceOk ? "text-green-700" : "text-red-700"}>
                      {Number(r.attendancePct)}% / {Number(r.threshold)}%
                    </span>
                  </td>
                  <td className="p-3">
                    {r.feeGate ? (
                      <span className={r.feeOk ? "text-green-700" : "text-red-700"}>
                        {Number(r.pendingFees)} due
                      </span>
                    ) : (
                      <span className="text-zinc-400">n/a</span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.eligible ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Eligible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700" title={r.reason}>
                        <AlertTriangle className="h-3 w-3" /> {r.reason || "Not eligible"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleSingle(r)}
                      disabled={!r.eligible}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-400">
                    {search.trim()
                      ? "No students match your search."
                      : "No students found for this exam's class."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
