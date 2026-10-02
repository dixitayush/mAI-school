"use client";

import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import {
  Sparkles, Loader2, BookOpen, FileText, ClipboardList, BarChart3,
  Copy, Check, Download, Printer, RefreshCw, Eye, Code2, Wand2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Markdown from "@/components/Markdown";

const TOOLS = [
  { key: "lesson-plan", label: "Lesson Plan", icon: BookOpen, blurb: "Objectives, timed lesson flow, activities and checks for understanding." },
  { key: "worksheet", label: "Worksheet", icon: FileText, blurb: "A printable worksheet with sections and an answer key." },
  { key: "question-paper", label: "Question Paper", icon: ClipboardList, blurb: "A sectioned exam paper with marks and a marking scheme." },
  { key: "rubric", label: "Rubric", icon: BarChart3, blurb: "A criteria × level grid whose weights add up to the max score." },
];

const INITIAL = {
  "lesson-plan": { subject: "", topic: "", grade: "", duration_minutes: 45 },
  worksheet: { subject: "", topic: "", grade: "", num_questions: 10, difficulty: "medium" },
  "question-paper": { subject: "", topic: "", grade: "", total_marks: 80, difficulty: "mixed", duration: "" },
  rubric: { subject: "", assignment_title: "", grade: "", criteria: "", max_score: 100 },
};

/** One-click starting points shown before anything is generated. */
const EXAMPLES = {
  "lesson-plan": [
    { subject: "Mathematics", topic: "Quadratic Equations", grade: "10" },
    { subject: "Science", topic: "Photosynthesis", grade: "7" },
  ],
  worksheet: [
    { subject: "Mathematics", topic: "Linear Equations in Two Variables", grade: "9" },
    { subject: "English", topic: "Active and Passive Voice", grade: "8" },
  ],
  "question-paper": [
    { subject: "Physics", topic: "Laws of Motion, Gravitation", grade: "9" },
    { subject: "Mathematics", topic: "Trigonometry", grade: "10" },
  ],
  rubric: [
    { subject: "Science", assignment_title: "Model of the Solar System", criteria: "Accuracy, creativity, presentation" },
    { subject: "English", assignment_title: "Persuasive Essay", criteria: "Argument, structure, language, conventions" },
  ],
};

const inputCls =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-zinc-700">
        {label}
        {hint && <span className="text-xs font-normal text-zinc-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AIStudioPage() {
  const [active, setActive] = useState("lesson-plan");
  const [forms, setForms] = useState(INITIAL);
  // Last result per tool, so switching tabs does not throw work away.
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("preview");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);

  const tool = TOOLS.find((t) => t.key === active);
  const form = forms[active];
  const result = results[active];
  const set = (key) => (e) => setForms((f) => ({ ...f, [active]: { ...f[active], [key]: e.target.value } }));

  const run = async (body = form) => {
    setLoading(true);
    setView("preview");
    try {
      const data = await apiFetch(`/api/ai/${active}`, { method: "POST", body, timeoutMs: 90000 });
      setResults((r) => ({ ...r, [active]: { content: data.content || "", model: data.model, input: body, at: new Date() } }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => { e.preventDefault(); run(); };

  const applyExample = (ex) => {
    const next = { ...form, ...ex };
    setForms((f) => ({ ...f, [active]: next }));
    run(next);
  };

  const title = result
    ? [tool.label, result.input.topic || result.input.assignment_title, result.input.grade && `Class ${result.input.grade}`]
        .filter(Boolean).join(" · ")
    : tool.label;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy is not available here");
    }
  };

  const download = () => {
    const blob = new Blob([result.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(title) || "ai-studio"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prints just the rendered document, carrying the page's styles (Tailwind
  // and KaTeX) into the print window so maths and tables look the same.
  const print = () => {
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return toast.error("Allow pop-ups to print");
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
    const safeTitle = title.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>${styles}
      <style>body{background:#fff;padding:32px 40px;max-width:820px;margin:auto}@page{margin:16mm}</style></head>
      <body>${previewRef.current?.innerHTML || ""}</body></html>`);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-500 text-white shadow-sm">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Studio</h1>
          <p className="text-sm text-zinc-500">Generate classroom-ready teaching material — review it, then print or share.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`relative flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                on ? "border-primary-500 bg-primary-50 text-primary-800 ring-2 ring-primary-500/20" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${on ? "text-primary-600" : "text-zinc-400"}`} />
              {t.label}
              {results[t.key] && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary-500" title="Has a result" />}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <motion.form
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submit}
          className="h-fit space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-4"
        >
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{tool.label}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{tool.blurb}</p>
          </div>

          <Field label="Subject">
            <input value={form.subject} onChange={set("subject")} required className={inputCls} placeholder="e.g. Mathematics" />
          </Field>

          {active === "rubric" ? (
            <Field label="Assignment">
              <input value={form.assignment_title} onChange={set("assignment_title")} required className={inputCls} placeholder="e.g. Science Project" />
            </Field>
          ) : (
            <Field label={active === "question-paper" ? "Chapters / topics" : "Topic"}>
              <input value={form.topic} onChange={set("topic")} required className={inputCls} placeholder="e.g. Quadratic Equations" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Class" hint={active === "rubric" ? "optional" : undefined}>
              <input value={form.grade} onChange={set("grade")} required={active !== "rubric"} className={inputCls} placeholder="e.g. 10" />
            </Field>

            {active === "lesson-plan" && (
              <Field label="Minutes">
                <input type="number" value={form.duration_minutes} onChange={set("duration_minutes")} min={10} max={240} className={inputCls} />
              </Field>
            )}
            {active === "worksheet" && (
              <Field label="Questions">
                <input type="number" value={form.num_questions} onChange={set("num_questions")} min={1} max={50} className={inputCls} />
              </Field>
            )}
            {active === "question-paper" && (
              <Field label="Total marks">
                <input type="number" value={form.total_marks} onChange={set("total_marks")} min={1} max={200} className={inputCls} />
              </Field>
            )}
            {active === "rubric" && (
              <Field label="Max score">
                <input type="number" value={form.max_score} onChange={set("max_score")} min={1} className={inputCls} />
              </Field>
            )}
          </div>

          {(active === "worksheet" || active === "question-paper") && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Difficulty">
                <select value={form.difficulty} onChange={set("difficulty")} className={inputCls}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </Field>
              {active === "question-paper" && (
                <Field label="Time" hint="optional">
                  <input value={form.duration} onChange={set("duration")} className={inputCls} placeholder="e.g. 3 hours" />
                </Field>
              )}
            </div>
          )}

          {active === "rubric" && (
            <Field label="Criteria" hint="optional">
              <textarea value={form.criteria} onChange={set("criteria")} rows={3} className={inputCls} placeholder="e.g. Research quality, presentation, creativity" />
            </Field>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating…" : result ? "Generate again" : "Generate"}
          </button>
        </motion.form>

        <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-900">{title}</h2>
              {result && (
                <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <Sparkles className="h-3 w-3 text-violet-500" /> AI generated · review before use
                  {result.at && ` · ${result.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              )}
            </div>
            {result && !loading && (
              <div className="flex items-center gap-1">
                <div className="mr-1 flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
                  {[["preview", "Preview", Eye], ["source", "Markdown", Code2]].map(([v, l, Icon]) => (
                    <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                      <Icon className="h-3.5 w-3.5" /> {l}
                    </button>
                  ))}
                </div>
                <IconButton onClick={copy} title="Copy Markdown">{copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}</IconButton>
                <IconButton onClick={download} title="Download .md"><Download className="h-4 w-4" /></IconButton>
                <IconButton onClick={print} title="Print / save as PDF"><Printer className="h-4 w-4" /></IconButton>
                <IconButton onClick={() => run(result.input)} title="Regenerate"><RefreshCw className="h-4 w-4" /></IconButton>
              </div>
            )}
          </div>

          <div className="px-5 py-6 sm:px-8">
            {loading ? (
              <div className="animate-pulse space-y-3" aria-label="Generating">
                <div className="h-7 w-2/3 rounded-lg bg-zinc-100" />
                <div className="h-4 w-full rounded bg-zinc-100" />
                <div className="h-4 w-5/6 rounded bg-zinc-100" />
                <div className="mt-6 h-5 w-1/3 rounded bg-zinc-100" />
                <div className="h-24 w-full rounded-xl bg-zinc-100" />
                <div className="h-4 w-4/5 rounded bg-zinc-100" />
                <div className="h-4 w-3/5 rounded bg-zinc-100" />
              </div>
            ) : result ? (
              view === "preview" ? (
                <div ref={previewRef}><Markdown>{result.content}</Markdown></div>
              ) : (
                <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-700">{result.content}</pre>
              )
            ) : (
              <div className="py-12 text-center">
                <Wand2 className="mx-auto h-10 w-10 text-zinc-300" />
                <p className="mt-3 text-sm font-medium text-zinc-600">Your {tool.label.toLowerCase()} will appear here</p>
                <p className="mt-1 text-xs text-zinc-400">Fill in the form, or start from an example:</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {EXAMPLES[active].map((ex) => (
                    <button
                      key={ex.topic || ex.assignment_title}
                      onClick={() => applyExample(ex)}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                    >
                      {ex.topic || ex.assignment_title}{ex.grade ? ` · Class ${ex.grade}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, ...props }) {
  return (
    <button type="button" className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800" {...props}>
      {children}
    </button>
  );
}
