"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { BarChart3, Plus, Loader2, Eye, Send, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SurveysPage() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewResults, setViewResults] = useState(null);
  const [results, setResults] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", target_audience: "all", questions: [{ text: "", type: "text" }] });

  const fetchSurveys = async () => {
    try {
      const data = await apiFetch("/api/surveys");
      setSurveys(data.surveys || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSurveys(); }, []);

  const addQuestion = () => setForm(f => ({ ...f, questions: [...f.questions, { text: "", type: "text" }] }));
  const updateQuestion = (i, field, val) => setForm(f => ({ ...f, questions: f.questions.map((q, j) => j === i ? { ...q, [field]: val } : q) }));
  const removeQuestion = (i) => setForm(f => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }));

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.title || form.questions.some(q => !q.text)) return toast.error("Fill all fields");
    setCreating(true);
    try {
      await apiFetch("/api/surveys", { method: "POST", body: form });
      toast.success("Survey created");
      setShowCreate(false);
      setForm({ title: "", description: "", target_audience: "all", questions: [{ text: "", type: "text" }] });
      fetchSurveys();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const toggleStatus = async (id, current) => {
    const status = current === "active" ? "closed" : "active";
    try {
      await apiFetch(`/api/surveys/${id}`, { method: "PATCH", body: { status } });
      toast.success(`Survey ${status}`);
      fetchSurveys();
    } catch (err) { toast.error(err.message); }
  };

  const loadResults = async (id) => {
    try {
      const data = await apiFetch(`/api/surveys/${id}/results`);
      setResults(data);
      setViewResults(id);
    } catch (err) { toast.error(err.message); }
  };

  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const STATUS = { draft: "bg-zinc-100 text-zinc-700", active: "bg-emerald-100 text-emerald-800", closed: "bg-red-100 text-red-800" };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><BarChart3 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Surveys</h1>
            <p className="text-sm text-zinc-500">Create and manage surveys and feedback forms.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> New Survey
        </button>
      </div>

      {showCreate && (
        <motion.form initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onSubmit={onCreate} className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Survey title" className={inputCls} required />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className={inputCls} />
          <select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))} className={inputCls}>
            <option value="all">All</option><option value="students">Students</option><option value="teachers">Teachers</option><option value="parents">Parents</option>
          </select>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-zinc-700">Questions</p>
            {form.questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={q.text} onChange={e => updateQuestion(i, "text", e.target.value)} placeholder={`Question ${i + 1}`} className={inputCls} required />
                <select value={q.type} onChange={e => updateQuestion(i, "type", e.target.value)} className="rounded-xl border border-zinc-300 px-2 py-2.5 text-sm">
                  <option value="text">Text</option><option value="rating">Rating</option><option value="yes_no">Yes/No</option>
                </select>
                {form.questions.length > 1 && <button type="button" onClick={() => removeQuestion(i)} className="text-zinc-400 hover:text-red-500"><X className="h-4 w-4" /></button>}
              </div>
            ))}
            <button type="button" onClick={addQuestion} className="text-sm font-medium text-primary-600 hover:text-primary-700">+ Add question</button>
          </div>
          <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Create
          </button>
        </motion.form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
      ) : surveys.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No surveys yet. Create one to get started.</div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div>
                <p className="font-semibold text-zinc-900">{s.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{s.description || "No description"} &middot; {s.response_count ?? 0} responses</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[s.status] || STATUS.draft}`}>{s.status}</span>
                <button onClick={() => loadResults(s.id)} className="text-zinc-400 hover:text-primary-600"><Eye className="h-4 w-4" /></button>
                <button onClick={() => toggleStatus(s.id, s.status)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  {s.status === "active" ? "Close" : "Activate"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {viewResults && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm" onClick={() => setViewResults(null)}>
          <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Survey Results</h3>
              <button onClick={() => setViewResults(null)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-zinc-700">{JSON.stringify(results, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
