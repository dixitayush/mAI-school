"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowLeft, CalendarRange, CheckCircle2, Download, FileText, Layers, Loader2, XCircle } from "lucide-react";
import Modal from "@/components/Modal";
import { apiFetch } from "@/lib/api";
import { classLabel, generateReportCard, gradeFor, summarizeReportCard } from "@/lib/generateReportCard";

const fmt = (d) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const dateRange = (a, b) => (a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`);

/**
 * Report card download, in the order a school office would ask for it:
 * which session → which exam (or the full session) → preview → download.
 * Works for any student the caller may see (self, a linked child, or staff).
 */
export default function ReportCardDownloader({ studentId, isOpen, onClose }) {
  const [options, setOptions] = useState(null);
  const [session, setSession] = useState(null);
  // undefined = not chosen yet; null = full session; string = one exam title.
  const [exam, setExam] = useState(undefined);
  const [card, setCard] = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);

  useEffect(() => {
    if (!isOpen || !studentId) return;
    let alive = true;
    apiFetch(`/api/students/${studentId}/report-cards`)
      .then((d) => { if (alive) setOptions(d); })
      .catch((err) => toast.error(err.message));
    return () => { alive = false; };
  }, [isOpen, studentId]);

  const close = () => {
    setSession(null);
    setExam(undefined);
    setCard(null);
    onClose();
  };

  const chooseExam = async (title) => {
    setExam(title);
    setCard(null);
    setLoadingCard(true);
    try {
      const q = new URLSearchParams({ session_id: session.id });
      if (title) q.set("exam", title);
      setCard(await apiFetch(`/api/students/${studentId}/report-card?${q}`));
    } catch (err) {
      toast.error(err.message);
      setExam(undefined);
    } finally {
      setLoadingCard(false);
    }
  };

  const download = () => {
    try {
      generateReportCard(card);
      toast.success("Report card downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the report card");
    }
  };

  const step = !session ? 1 : exam === undefined ? 2 : 3;
  const back = () => (step === 3 ? (setExam(undefined), setCard(null)) : setSession(null));

  return (
    <Modal isOpen={isOpen} onClose={close} title="Download Report Card" maxWidth="max-w-2xl">
      <ol className="mb-5 flex items-center gap-2 text-xs font-medium">
        {["Session", "Exam", "Download"].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
              step > i + 1 ? "bg-primary-600 text-white" : step === i + 1 ? "bg-primary-100 text-primary-800 ring-2 ring-primary-500" : "bg-zinc-100 text-zinc-400"
            }`}>
              {step > i + 1 ? "✓" : i + 1}
            </span>
            <span className={step === i + 1 ? "text-zinc-900" : "text-zinc-400"}>{label}</span>
            {i < 2 && <span className="h-px w-6 bg-zinc-200" />}
          </li>
        ))}
      </ol>

      {step > 1 && (
        <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      {step === 1 && (
        !options ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
        ) : options.sessions.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No academic sessions found.</p>
        ) : (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-zinc-500">Choose the academic session.</p>
            {options.sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSession(s)}
                disabled={s.exams.length === 0}
                className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 p-4 text-left transition hover:border-primary-400 hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-200 disabled:hover:bg-transparent"
              >
                <CalendarRange className="h-5 w-5 shrink-0 text-primary-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold text-zinc-900">
                    {s.name}
                    {s.is_current && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">Current</span>}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {s.class_name ? `Class ${classLabel(s.class_name, s.section)}` : "Class not recorded"}
                    {s.roll_number ? ` · Roll ${s.roll_number}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {s.exams.length ? `${s.exams.length} exam${s.exams.length === 1 ? "" : "s"}` : "No results yet"}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {step === 2 && (
        <div className="space-y-2">
          <p className="mb-2 text-sm text-zinc-500">
            Session <span className="font-semibold text-zinc-800">{session.name}</span> — choose an exam, or the full session.
          </p>
          {session.exams.length > 1 && (
            <button
              onClick={() => chooseExam(null)}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-primary-200 bg-primary-50/50 p-4 text-left transition hover:border-primary-400"
            >
              <Layers className="h-5 w-5 shrink-0 text-primary-700" />
              <span className="flex-1">
                <span className="block font-semibold text-zinc-900">Full session report card</span>
                <span className="block text-xs text-zinc-500">All {session.exams.length} exams side by side, with session totals</span>
              </span>
            </button>
          )}
          {[...session.exams].reverse().map((x) => (
            <button
              key={x.title}
              onClick={() => chooseExam(x.title)}
              className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 p-4 text-left transition hover:border-primary-400 hover:bg-primary-50/40"
            >
              <FileText className="h-5 w-5 shrink-0 text-zinc-500" />
              <span className="flex-1">
                <span className="block font-semibold text-zinc-900">{x.title}</span>
                <span className="block text-xs text-zinc-500">
                  {x.subjects} subject{x.subjects === 1 ? "" : "s"} · {dateRange(x.first_date, x.last_date)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        loadingCard || !card ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
        ) : (
          <ReportCardPreview card={card} onDownload={download} />
        )
      )}
    </Modal>
  );
}

function ReportCardPreview({ card, onDownload }) {
  const summary = summarizeReportCard(card);
  const subjects = [...new Set(card.results.map((r) => r.subject))];
  const att = card.attendance || {};

  return (
    <div>
      <div className="mb-3 rounded-xl bg-zinc-50 p-3 text-sm">
        <p className="font-semibold text-zinc-900">
          {card.student.full_name}
          <span className="ml-2 font-mono text-xs font-semibold text-indigo-600">{card.student.registration_id}</span>
        </p>
        <p className="text-xs text-zinc-500">
          {card.session.name} · {card.exam || "Full session"}
          {card.student.class_name ? ` · Class ${classLabel(card.student.class_name, card.student.section)}` : ""}
          {card.student.roll_number ? ` · Roll ${card.student.roll_number}` : ""}
        </p>
      </div>

      <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
            <tr>
              <th className="px-3 py-2">Subject</th>
              {!card.exam && card.exams.map((t) => <th key={t} className="px-3 py-2 text-center">{t}</th>)}
              <th className="px-3 py-2 text-center">Marks</th>
              <th className="px-3 py-2 text-center">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {subjects.map((subject) => {
              const rows = card.results.filter((r) => r.subject === subject);
              const got = rows.reduce((s, r) => s + Number(r.marks_obtained), 0);
              const max = rows.reduce((s, r) => s + Number(r.total_marks), 0);
              const failed = rows.some((r) => Number(r.marks_obtained) < Number(r.passing_marks));
              return (
                <tr key={subject}>
                  <td className="px-3 py-2 font-medium text-zinc-800">{subject}</td>
                  {!card.exam && card.exams.map((t) => {
                    const r = rows.find((x) => x.title === t);
                    return <td key={t} className="px-3 py-2 text-center text-zinc-600">{r ? `${r.marks_obtained}/${r.total_marks}` : "—"}</td>;
                  })}
                  <td className={`px-3 py-2 text-center ${failed ? "font-semibold text-red-600" : "text-zinc-700"}`}>{got}/{max}</td>
                  <td className="px-3 py-2 text-center font-semibold text-zinc-800">
                    {card.exam && rows[0]?.grade ? rows[0].grade : gradeFor(max ? (got / max) * 100 : 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Overall" value={`${summary.percentage.toFixed(1)}%`} />
        <Stat label="Grade" value={summary.grade} />
        <Stat
          label="Result"
          value={
            summary.passed
              ? <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-4 w-4" /> Pass</span>
              : <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" /> Needs work</span>
          }
        />
        <Stat label="Attendance" value={`${Number(att.percentage ?? 0).toFixed(1)}%`} />
      </div>

      <button
        onClick={onDownload}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
      >
        <Download className="h-4 w-4" /> Download PDF
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
