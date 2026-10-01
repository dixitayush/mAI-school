"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useFilterOptions, toQuery } from "@/lib/useFilterOptions";

const ctl =
  "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

/**
 * Searchable student picker.
 *
 * Replaces a `<select>` holding the whole roster: at 500–1000 students a plain
 * dropdown is unusable, so this queries the server as the user types and lets
 * them narrow by class and section first. Accepts a pasted student uuid.
 */
export default function StudentPicker({
  value,
  onChange,
  label = "Student",
  required = false,
  placeholder = "Search by name, roll no, admission no or student ID…",
}) {
  const { options } = useFilterOptions();
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("");
  const [section, setSection] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const boxRef = useRef(null);

  // Keep the chosen student's label visible when the parent sets/clears value.
  useEffect(() => {
    if (!value) setSelected(null);
    else if (selected?.id !== value) {
      apiFetch(`/api/students?student_id=${value}&limit=1`)
        .then((d) => setSelected(d.students?.[0] || null))
        .catch(() => {});
    }
  }, [value, selected?.id]);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(
        `/api/students${toQuery({ search: query, class_id: classId, section, limit: 25 })}`
      );
      setResults(d.students || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, classId, section]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(search, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, search, query]);

  // Close when clicking away so the list does not cover the form.
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s) => {
    setSelected(s);
    onChange(s.id, s);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={boxRef} className="relative">
      {label && <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>}

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2">
          <span className="min-w-0 truncate text-sm">
            <span className="font-medium text-zinc-900">{selected.full_name}</span>
            <span className="text-zinc-500">
              {selected.class_name ? ` · ${selected.class_name}` : ""}
              {selected.section ? `/${selected.section}` : ""}
              {selected.roll_number ? ` · Roll ${selected.roll_number}` : ""}
            </span>
            <span className="ml-1 font-mono text-[11px] text-zinc-400">
              {String(selected.id).split("-")[0]}…
            </span>
          </span>
          <button
            type="button"
            onClick={() => { setSelected(null); onChange("", null); setOpen(true); }}
            className="shrink-0 rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Clear selected student"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            placeholder={placeholder}
            required={required && !value}
            className={`${ctl} w-full pl-9`}
          />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex gap-2 border-b border-zinc-100 p-2">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${ctl} flex-1 text-xs`} aria-label="Filter by class">
              <option value="">All classes</option>
              {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={section} onChange={(e) => setSection(e.target.value)} className={`${ctl} w-28 text-xs`} aria-label="Filter by section">
              <option value="">All sections</option>
              {options.sections.map((s) => <option key={s} value={s}>Sec {s}</option>)}
            </select>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                {query ? "No students match." : "Type to search, or filter by class."}
              </p>
            ) : (
              results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900">{s.full_name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {s.class_name || "Unassigned"}
                      {s.section ? ` · ${s.section}` : ""}
                      {s.roll_number ? ` · Roll ${s.roll_number}` : ""}
                      <span className="ml-1 font-mono text-zinc-400">{String(s.id).split("-")[0]}…</span>
                    </span>
                  </span>
                  {value === s.id && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
