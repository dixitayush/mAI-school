"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkles, Loader2, BookOpen, FileText, ClipboardList, BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const TOOLS = [
  { key: "lesson-plan", label: "Lesson Plan", icon: BookOpen, color: "bg-primary-50 text-primary-700" },
  { key: "worksheet", label: "Worksheet", icon: FileText, color: "bg-blue-50 text-blue-700" },
  { key: "question-paper", label: "Question Paper", icon: ClipboardList, color: "bg-amber-50 text-amber-700" },
  { key: "rubric", label: "Rubric", icon: BarChart3, color: "bg-violet-50 text-violet-700" },
];

const INITIAL = {
  "lesson-plan": { subject: "", topic: "", grade: "", duration_minutes: 45 },
  worksheet: { subject: "", topic: "", grade: "", num_questions: 10 },
  "question-paper": { subject: "", topic: "", grade: "", total_marks: 100, difficulty: "medium" },
  rubric: { subject: "", assignment_title: "", criteria: "", max_score: 100 },
};

const inputCls =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

export default function AIStudioPage() {
  const [active, setActive] = useState("lesson-plan");
  const [forms, setForms] = useState(INITIAL);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const form = forms[active];
  const set = (key) => (e) =>
    setForms((f) => ({ ...f, [active]: { ...f[active], [key]: e.target.value } }));

  const generate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch(`/api/ai/${active}`, { method: "POST", body: form, timeoutMs: 60000 });
      setResult(data);
      toast.success("Generated successfully");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resultText =
    result?.lesson_plan || result?.worksheet || result?.question_paper || result?.rubric || result?.content || (result ? JSON.stringify(result, null, 2) : null);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Studio</h1>
          <p className="text-sm text-zinc-500">Generate teaching materials with AI assistance.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setActive(t.key); setResult(null); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active === t.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.form
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={generate}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-zinc-900">
            {TOOLS.find((t) => t.key === active)?.label}
          </h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Subject</label>
            <input value={form.subject} onChange={set("subject")} required className={inputCls} placeholder="e.g. Mathematics" />
          </div>

          {active !== "rubric" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Topic</label>
              <input value={form.topic} onChange={set("topic")} required className={inputCls} placeholder="e.g. Quadratic Equations" />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Assignment Title</label>
              <input value={form.assignment_title} onChange={set("assignment_title")} required className={inputCls} placeholder="e.g. Science Project" />
            </div>
          )}

          {active !== "rubric" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Grade/Class</label>
              <input value={form.grade} onChange={set("grade")} required className={inputCls} placeholder="e.g. 10" />
            </div>
          )}

          {active === "lesson-plan" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Duration (minutes)</label>
              <input type="number" value={form.duration_minutes} onChange={set("duration_minutes")} min={10} className={inputCls} />
            </div>
          )}

          {active === "worksheet" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Number of questions</label>
              <input type="number" value={form.num_questions} onChange={set("num_questions")} min={1} className={inputCls} />
            </div>
          )}

          {active === "question-paper" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Total marks</label>
                <input type="number" value={form.total_marks} onChange={set("total_marks")} min={1} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Difficulty</label>
                <select value={form.difficulty} onChange={set("difficulty")} className={inputCls}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </>
          )}

          {active === "rubric" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Criteria</label>
                <textarea value={form.criteria} onChange={set("criteria")} rows={3} className={inputCls} placeholder="e.g. Research quality, presentation, creativity" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Max score</label>
                <input type="number" value={form.max_score} onChange={set("max_score")} min={1} className={inputCls} />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
        </motion.form>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Output</h2>
            {resultText && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                <Sparkles className="h-3 w-3" /> AI Generated
              </span>
            )}
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Generating...
              </div>
            ) : resultText ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-zinc-700">{resultText}</div>
            ) : (
              <p className="py-16 text-center text-sm text-zinc-400">
                Fill in the form and click Generate to create content.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
