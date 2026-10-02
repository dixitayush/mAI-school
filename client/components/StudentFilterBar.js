"use client";

import { Search, X, Filter } from "lucide-react";
import { useFilterOptions } from "@/lib/useFilterOptions";

const selectCls =
  "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

/**
 * The filter bar shared by every student-heavy screen.
 *
 * A roster of 500–1000 students cannot be browsed, so each screen narrows by
 * session, class, section and grade and searches by name, roll number,
 * admission number or student uuid. `show` picks which controls appear so a
 * screen only offers filters its data actually supports.
 */
export default function StudentFilterBar({
  value,
  onChange,
  show = ["session", "class", "section", "search"],
  searchPlaceholder = "Search name, registration ID, roll no or admission no…",
  extra = null,
  resultCount = null,
}) {
  const { options } = useFilterOptions();
  const has = (k) => show.includes(k);

  const set = (key) => (e) => {
    const v = e?.target ? e.target.value : e;
    // Changing any filter returns to the first page of results.
    onChange({ ...value, [key]: v, page: 1 });
  };

  const activeCount = ["session_id", "class_id", "section", "grade_level", "lifecycle_status", "search"]
    .filter((k) => value?.[k]).length;

  const clear = () =>
    onChange({
      ...value,
      session_id: "",
      class_id: "",
      section: "",
      grade_level: "",
      lifecycle_status: "",
      search: "",
      page: 1,
    });

  return (
    <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {has("search") && (
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={value?.search || ""}
              onChange={set("search")}
              placeholder={searchPlaceholder}
              className={`${selectCls} w-full pl-9`}
            />
          </div>
        )}

        {has("session") && (
          <select value={value?.session_id || ""} onChange={set("session_id")} className={selectCls} aria-label="Academic session">
            <option value="">Current roster</option>
            {options.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
        )}

        {has("class") && (
          <select value={value?.class_id || ""} onChange={set("class_id")} className={selectCls} aria-label="Class">
            <option value="">All classes</option>
            {options.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {has("section") && (
          <select value={value?.section || ""} onChange={set("section")} className={selectCls} aria-label="Section">
            <option value="">All sections</option>
            {options.sections.map((s) => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </select>
        )}

        {has("grade") && (
          <select value={value?.grade_level || ""} onChange={set("grade_level")} className={selectCls} aria-label="Grade">
            <option value="">All grades</option>
            {options.grade_levels.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        )}

        {has("exam") && (
          <select value={value?.exam_id || ""} onChange={set("exam_id")} className={selectCls} aria-label="Exam">
            <option value="">All exams</option>
            {options.exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}{e.class_name ? ` · ${e.class_name}` : ""}
              </option>
            ))}
          </select>
        )}

        {has("status") && (
          <select value={value?.lifecycle_status || ""} onChange={set("lifecycle_status")} className={selectCls} aria-label="Status">
            <option value="">Any status</option>
            {options.lifecycle_statuses.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        )}

        {extra}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {(resultCount !== null || activeCount > 0) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <Filter className="h-3.5 w-3.5" />
          {resultCount !== null && <span>{resultCount} result{resultCount === 1 ? "" : "s"}</span>}
          {activeCount > 0 && <span>· {activeCount} filter{activeCount === 1 ? "" : "s"} active</span>}
          {value?.session_id && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
              Viewing a past session — data is historical
            </span>
          )}
        </div>
      )}
    </div>
  );
}
