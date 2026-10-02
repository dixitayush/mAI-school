"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { CalendarRange, Plus, Loader2, CheckCircle2, ArrowRight, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useFilterOptions, invalidateFilterOptions, toQuery } from "@/lib/useFilterOptions";
import Uuid from "@/components/Uuid";
import StudentId from "@/components/StudentId";

const inputCls =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

/**
 * Academic sessions and year-end promotion.
 *
 * A session is what makes the roster historical: promoting students into a new
 * session keeps the old placement on record, so "class 6 last year, class 7 now"
 * is a fact the system can report on rather than an overwrite.
 */
export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_current: false });

  const { options } = useFilterOptions();

  // Promotion state
  const [promo, setPromo] = useState({
    from_session_id: "", from_class_id: "", from_section: "",
    to_session_id: "", to_class_id: "", to_section: "", outcome: "promoted",
  });
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState({});
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch("/api/academics/sessions");
      setSessions(d.sessions || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch("/api/academics/sessions", { method: "POST", body: form });
      toast.success("Session created");
      setShowCreate(false);
      setForm({ name: "", start_date: "", end_date: "", is_current: false });
      invalidateFilterOptions();
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const makeCurrent = async (id) => {
    try {
      await apiFetch(`/api/academics/sessions/${id}/current`, { method: "PATCH" });
      toast.success("Current session updated");
      invalidateFilterOptions();
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const findCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const d = await apiFetch(
        `/api/students${toQuery({
          session_id: promo.from_session_id,
          class_id: promo.from_class_id,
          section: promo.from_section,
          limit: 1000,
        })}`
      );
      setCandidates(d.students || []);
      // Pre-select everyone found: promoting a whole class is the normal case.
      setPicked(Object.fromEntries((d.students || []).map((s) => [s.id, true])));
      if ((d.students || []).length === 0) toast("No students match that class and session");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const runPromotion = async () => {
    const ids = Object.keys(picked).filter((k) => picked[k]);
    if (ids.length === 0) return toast.error("Select at least one student");
    if (!promo.to_session_id || !promo.to_class_id) return toast.error("Pick the target session and class");
    setPromoting(true);
    try {
      const res = await apiFetch("/api/academics/promote", {
        method: "POST",
        body: {
          student_ids: ids,
          from_session_id: promo.from_session_id || null,
          to_session_id: promo.to_session_id,
          to_class_id: promo.to_class_id,
          to_section: promo.to_section || null,
          outcome: promo.outcome,
        },
      });
      toast.success(`${res.promoted} student(s) ${res.outcome}`);
      setCandidates([]);
      setPicked({});
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPromoting(false);
    }
  };

  const pickedCount = Object.values(picked).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Academic Sessions</h1>
            <p className="text-sm text-zinc-500">Manage school years and promote students between them.</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Session
        </button>
      </div>

      {showCreate && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={create}
          className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 2027-2028" className={inputCls} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Starts</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Ends</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className={inputCls} required />
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={form.is_current} onChange={(e) => setForm((f) => ({ ...f, is_current: e.target.checked }))} className="h-4 w-4 rounded border-zinc-300" />
            Make this the current session
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
      ) : (
        <div className="mb-8 space-y-3">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white py-16 text-center text-sm text-zinc-400 shadow-sm">No sessions yet.</div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-zinc-900">
                    {s.name}
                    {s.is_current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Current
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    {new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {s.student_count} enrolled</span>
                    <Uuid value={s.id} label="Session ID" />
                  </p>
                </div>
                {!s.is_current && (
                  <button onClick={() => makeCurrent(s.id)} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
                    Make current
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Promotion */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Promote students</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Move a class into the next session. The old placement stays on record as class history.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">From</p>
            <div className="space-y-2">
              <select value={promo.from_session_id} onChange={(e) => setPromo((p) => ({ ...p, from_session_id: e.target.value }))} className={inputCls}>
                <option value="">Current roster</option>
                {options.sessions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select value={promo.from_class_id} onChange={(e) => setPromo((p) => ({ ...p, from_class_id: e.target.value }))} className={inputCls}>
                <option value="">All classes</option>
                {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={promo.from_section} onChange={(e) => setPromo((p) => ({ ...p, from_section: e.target.value }))} className={inputCls}>
                <option value="">All sections</option>
                {options.sections.map((sec) => <option key={sec} value={sec}>Section {sec}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-primary-50/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary-700">To</p>
            <div className="space-y-2">
              <select value={promo.to_session_id} onChange={(e) => setPromo((p) => ({ ...p, to_session_id: e.target.value }))} className={inputCls} required>
                <option value="">Select target session…</option>
                {options.sessions.map((o) => <option key={o.id} value={o.id}>{o.name}{o.is_current ? " (current)" : ""}</option>)}
              </select>
              <select value={promo.to_class_id} onChange={(e) => setPromo((p) => ({ ...p, to_class_id: e.target.value }))} className={inputCls} required>
                <option value="">Select target class…</option>
                {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={promo.to_section} onChange={(e) => setPromo((p) => ({ ...p, to_section: e.target.value }))} className={inputCls}>
                <option value="">Keep blank</option>
                {options.sections.map((sec) => <option key={sec} value={sec}>Section {sec}</option>)}
              </select>
              <select value={promo.outcome} onChange={(e) => setPromo((p) => ({ ...p, outcome: e.target.value }))} className={inputCls}>
                <option value="promoted">Mark old year as promoted</option>
                <option value="retained">Mark old year as retained</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={findCandidates} disabled={loadingCandidates} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60">
            {loadingCandidates ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Find students
          </button>
          {candidates.length > 0 && (
            <button onClick={runPromotion} disabled={promoting || pickedCount === 0} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60">
              {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Promote {pickedCount} student{pickedCount === 1 ? "" : "s"}
            </button>
          )}
        </div>

        {candidates.length > 0 && (
          <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs">
              <span className="font-semibold text-zinc-600">{candidates.length} found · {pickedCount} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setPicked(Object.fromEntries(candidates.map((c) => [c.id, true])))} className="font-medium text-primary-700 hover:underline">Select all</button>
                <button onClick={() => setPicked({})} className="font-medium text-zinc-500 hover:underline">Clear</button>
              </div>
            </div>
            {candidates.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-zinc-50 px-4 py-2 text-sm last:border-0 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={Boolean(picked[c.id])}
                  onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-zinc-900">{c.full_name}</span>
                  <span className="text-zinc-500">
                    {c.class_name ? ` · ${c.class_name}` : ""}{c.section ? `/${c.section}` : ""}
                    {c.roll_number ? ` · Roll ${c.roll_number}` : ""}
                  </span>
                </span>
                <StudentId value={c.registration_id} />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
