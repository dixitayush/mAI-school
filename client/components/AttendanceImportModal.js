"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { apiUpload, apiFetch } from "@/lib/api";

const STATUS_OPTS = ["present", "absent", "late"];

function confidenceBadge(c) {
  const pct = Math.round((c ?? 0) * 100);
  if (c >= 0.8) return { cls: "bg-green-100 text-green-700", label: `${pct}%` };
  if (c >= 0.5) return { cls: "bg-yellow-100 text-yellow-700", label: `${pct}%` };
  return { cls: "bg-red-100 text-red-700", label: `${pct}%` };
}

/**
 * AI attendance register import: upload a photo/PDF -> Gemini OCR ->
 * editable preview -> bulk commit to attendance.
 */
export default function AttendanceImportModal({
  open,
  onClose,
  classes = [],
  defaultClassId = "",
  onCommitted,
}) {
  const fileRef = useRef(null);
  const [classId, setClassId] = useState(defaultClassId);
  const [phase, setPhase] = useState("upload"); // upload | review
  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [importId, setImportId] = useState(null);
  const [rows, setRows] = useState([]);
  const [roster, setRoster] = useState([]);

  const reset = () => {
    setPhase("upload");
    setRows([]);
    setRoster([]);
    setImportId(null);
    setExtracting(false);
    setCommitting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const data = await apiUpload("/api/ai/attendance/extract", file, {
        class_id: classId || undefined,
      });
      setImportId(data.import_id);
      setRoster(data.roster || []);
      if (data.date) setDate(data.date);
      setRows(
        (data.rows || []).map((r) => ({
          student_id: r.matched_student_id || "",
          name: r.name,
          roll_number: r.roll_number,
          status: r.status,
          confidence: r.confidence,
          accepted: r.matched_student_id ? r.accepted : false,
        }))
      );
      setPhase("review");
      const unmatched = (data.rows || []).filter((r) => !r.matched_student_id).length;
      toast.success(
        `Extracted ${data.rows?.length || 0} rows${unmatched ? ` (${unmatched} need matching)` : ""}`
      );
    } catch (err) {
      toast.error(err.message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const updateRow = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleCommit = async () => {
    const toCommit = rows.filter((r) => r.accepted && r.student_id);
    if (toCommit.length === 0) {
      toast.error("No matched, accepted rows to commit");
      return;
    }
    setCommitting(true);
    try {
      const res = await apiFetch("/api/ai/attendance/commit", {
        method: "POST",
        body: {
          import_id: importId,
          date,
          rows: toCommit.map((r) => ({ student_id: r.student_id, status: r.status })),
        },
      });
      toast.success(`Committed ${res.committed} attendance records`);
      onCommitted?.();
      close();
    } catch (err) {
      toast.error(err.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  const acceptedCount = rows.filter((r) => r.accepted && r.student_id).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">AI Attendance Register</h2>
                  <p className="text-xs text-zinc-500">
                    Upload a register photo — AI reads it, you review, then commit.
                  </p>
                </div>
              </div>
              <button type="button" onClick={close}>
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {phase === "upload" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500">
                      Class (helps match names/rolls)
                    </label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">All classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={extracting}
                    className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-10 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40 disabled:opacity-60"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                        <p className="text-sm font-medium text-zinc-700">
                          Reading register with AI…
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-zinc-400" />
                        <p className="text-sm font-medium text-zinc-700">
                          Click to upload register (JPG, PNG, PDF)
                        </p>
                        <p className="text-xs text-zinc-400">Max 8 MB</p>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleFile}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500">Date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-sm text-zinc-500">
                      {acceptedCount} of {rows.length} rows ready to commit
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-zinc-100">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
                        <tr>
                          <th className="p-2">✓</th>
                          <th className="p-2">Read name / roll</th>
                          <th className="p-2">Student</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Conf.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => {
                          const badge = confidenceBadge(r.confidence);
                          const lowConf = (r.confidence ?? 0) < 0.5;
                          return (
                            <tr
                              key={idx}
                              className={`border-t border-zinc-100 ${
                                lowConf ? "bg-red-50/40" : ""
                              }`}
                            >
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={r.accepted}
                                  onChange={(e) => updateRow(idx, { accepted: e.target.checked })}
                                  className="h-4 w-4 accent-primary-600"
                                />
                              </td>
                              <td className="p-2">
                                <p className="font-medium text-zinc-800">{r.name || "—"}</p>
                                {r.roll_number && (
                                  <p className="text-xs text-zinc-400">Roll {r.roll_number}</p>
                                )}
                              </td>
                              <td className="p-2">
                                <select
                                  value={r.student_id}
                                  onChange={(e) =>
                                    updateRow(idx, {
                                      student_id: e.target.value,
                                      accepted: Boolean(e.target.value),
                                    })
                                  }
                                  className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${
                                    r.student_id
                                      ? "border-zinc-300"
                                      : "border-red-300 bg-red-50"
                                  }`}
                                >
                                  <option value="">— unmatched —</option>
                                  {roster.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                      {s.roll_number ? ` (${s.roll_number})` : ""}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <select
                                  value={r.status}
                                  onChange={(e) => updateRow(idx, { status: e.target.value })}
                                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs focus:outline-none"
                                >
                                  {STATUS_OPTS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {rows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-zinc-400">
                              <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
                              No rows were extracted.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 p-4">
              {phase === "review" ? (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Upload another
                </button>
              ) : (
                <span />
              )}
              {phase === "review" && (
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={committing || acceptedCount === 0}
                  className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {committing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Commit {acceptedCount} record{acceptedCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
