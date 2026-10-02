"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Sparkles, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Markdown from "@/components/Markdown";
import { AiAllowanceBar, useAiAllowance } from "@/components/AiAllowance";

const inputCls =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

export default function StudyPlannerPage() {
  const [subjects, setSubjects] = useState([""]);
  const [examDate, setExamDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const allowance = useAiAllowance();

  const addSubject = () => setSubjects((s) => [...s, ""]);
  const removeSubject = (i) => setSubjects((s) => s.filter((_, idx) => idx !== i));
  const updateSubject = (i, v) => setSubjects((s) => s.map((sub, idx) => (idx === i ? v : sub)));

  const generate = async (e) => {
    e.preventDefault();
    const validSubjects = subjects.filter((s) => s.trim());
    if (validSubjects.length === 0) return toast.error("Add at least one subject");
    if (allowance.exhausted) return;
    // The previous plan stays put until a new one arrives, so a refused
    // request (daily limit) does not wipe it.
    setLoading(true);
    try {
      const data = await apiFetch("/api/ai/study-plan", {
        method: "POST",
        body: { subjects: validSubjects, exam_date: examDate, hours_per_day: Number(hoursPerDay) },
        timeoutMs: 60000,
      });
      setResult(data);
      allowance.track(data.usage);
      toast.success("Study plan generated");
    } catch (err) {
      allowance.trackError(err);
      if (!(err.status === 429 && err.data?.usage)) toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const planText = result?.content || null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Study Planner</h1>
          <p className="text-sm text-zinc-500">Get a personalized AI study schedule for your exams.</p>
        </div>
      </div>

      <AiAllowanceBar usage={allowance.usage} onReset={allowance.reload} className="mb-4" />

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={generate}
        className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">Subjects</label>
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={s}
                  onChange={(e) => updateSubject(i, e.target.value)}
                  placeholder={`Subject ${i + 1}`}
                  className={inputCls}
                />
                {subjects.length > 1 && (
                  <button type="button" onClick={() => removeSubject(i)} className="text-zinc-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addSubject} className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
            <Plus className="h-3.5 w-3.5" /> Add subject
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Exam date</label>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Hours per day</label>
            <input type="number" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} min={1} max={16} required className={inputCls} />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || allowance.exhausted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate Study Plan
        </button>
      </motion.form>

      {(loading || planText) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Your Study Plan</h2>
            {planText && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                <Sparkles className="h-3 w-3" /> AI Generated
              </span>
            )}
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Creating your plan...
              </div>
            ) : (
              <Markdown>{planText}</Markdown>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
