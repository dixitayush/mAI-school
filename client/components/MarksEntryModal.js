"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Save, Trophy, Search } from "lucide-react";
import { toast } from "react-hot-toast";

const GET_MARKS = gql`
  query GetMarks($classId: UUID!, $examId: UUID!) {
    allStudents(condition: { classId: $classId }, orderBy: ROLL_NUMBER_ASC) {
      nodes {
        id
        rollNumber
        section
        userByUserId {
          fullName
        }
      }
    }
    allResults(condition: { examId: $examId }) {
      nodes {
        studentId
        marksObtained
        grade
        feedback
      }
    }
  }
`;

const UPSERT_RESULT = gql`
  mutation UpsertResult($examId: UUID!, $studentId: UUID!, $marks: Int!, $feedback: String) {
    upsertResult(
      input: { pExamId: $examId, pStudentId: $studentId, pMarks: $marks, pFeedback: $feedback }
    ) {
      result {
        id
        grade
      }
    }
  }
`;

/**
 * Marks-entry grid for a single exam. Prefills existing results, lets the
 * teacher/admin enter marks per student, then saves via upsertResult
 * (which auto-grades and audit-logs server-side).
 */
export default function MarksEntryModal({ open, exam, onClose, onSaved }) {
  const skip = !open || !exam;
  const { data, loading, refetch } = useQuery(GET_MARKS, {
    variables: { classId: exam?.classId, examId: exam?.id },
    skip,
    fetchPolicy: "network-only",
  });
  const [upsertResult] = useMutation(UPSERT_RESULT);
  const [marks, setMarks] = useState({});
  const [feedback, setFeedback] = useState({});
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (data) {
      const existing = {};
      const fb = {};
      (data.allResults?.nodes || []).forEach((r) => {
        existing[r.studentId] = r.marksObtained ?? "";
        if (r.feedback) fb[r.studentId] = r.feedback;
      });
      setMarks(existing);
      setFeedback(fb);
    }
  }, [data]);

  const students = useMemo(() => data?.allStudents?.nodes || [], [data]);

  const sections = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.section) set.add(s.section);
    });
    return Array.from(set).sort();
  }, [students]);

  const displayedStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (section && (s.section || "") !== section) return false;
      if (!q) return true;
      const name = (s.userByUserId?.fullName || "").toLowerCase();
      const roll = (s.rollNumber || "").toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
  }, [students, section, search]);

  if (!open || !exam) return null;

  const total = exam.totalMarks;

  const handleSave = async () => {
    const entries = students.filter((s) => marks[s.id] !== "" && marks[s.id] != null);
    if (entries.length === 0) {
      toast.error("Enter at least one mark");
      return;
    }
    for (const s of entries) {
      const m = Number(marks[s.id]);
      if (Number.isNaN(m) || m < 0 || m > total) {
        toast.error(`Invalid marks for ${s.userByUserId?.fullName} (0–${total})`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const s of entries) {
        await upsertResult({
          variables: {
            examId: exam.id,
            studentId: s.id,
            marks: Number(marks[s.id]),
            feedback: feedback[s.id] || null,
          },
        });
      }
      toast.success(`Saved marks for ${entries.length} student(s)`);
      await refetch();
      onSaved?.();
    } catch (err) {
      toast.error(err.message || "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">{exam.title} — Marks</h2>
                <p className="text-xs text-zinc-500">
                  {exam.classByClassId?.name ? `${exam.classByClassId.name} · ` : ""}
                  {exam.subject} · out of {total} marks
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose}>
              <X className="h-5 w-5 text-zinc-400" />
            </button>
          </div>

          {students.length > 0 && (
            <div className="space-y-3 border-b border-zinc-100 px-5 py-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Class</label>
                  <select
                    value="fixed"
                    disabled
                    className="ui-select w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600"
                  >
                    <option value="fixed">{exam.classByClassId?.name || "This class"}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Section</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    disabled={sections.length === 0}
                    className="ui-select w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50"
                  >
                    <option value="">All sections</option>
                    {sections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                  <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by name or roll…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent text-sm text-zinc-700 outline-none"
                  />
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {displayedStudents.length} of {students.length}
                </span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : students.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">No students in this class.</p>
            ) : displayedStudents.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">No students match your filters.</p>
            ) : (
              <div className="space-y-2">
                {displayedStudents.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-800">
                        {s.userByUserId?.fullName}
                      </p>
                      {s.rollNumber && (
                        <p className="text-xs text-zinc-400">Roll {s.rollNumber}</p>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      placeholder="—"
                      value={marks[s.id] ?? ""}
                      onChange={(e) =>
                        setMarks((m) => ({ ...m, [s.id]: e.target.value }))
                      }
                      className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400">/ {total}</span>
                    <input
                      type="text"
                      placeholder="Feedback (optional)"
                      value={feedback[s.id] || ""}
                      onChange={(e) =>
                        setFeedback((f) => ({ ...f, [s.id]: e.target.value }))
                      }
                      className="hidden w-48 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none sm:block"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Marks
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
