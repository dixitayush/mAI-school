"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ArrowUpDown, Upload, Download, Loader2, FileDown, AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch, apiUpload, apiBase, authHeaders } from "@/lib/api";
import { useFilterOptions } from "@/lib/useFilterOptions";

const STATUS = {
  completed: "bg-emerald-100 text-emerald-800",
  uploaded: "bg-zinc-100 text-zinc-700",
  preview: "bg-sky-100 text-sky-800",
  validating: "bg-sky-100 text-sky-800",
  importing: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
};

const label = (s) => String(s || "").replace(/_/g, " ");


const EXPORT_SELECT_CLS =
  "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

// Option lists that mirror CHECK constraints rather than live data.
const STATUS_OPTIONS = {
  fees: ["pending", "partial", "paid", "overdue"],
  attendance: ["present", "absent", "late"],
  inventory: ["available", "assigned", "under_repair", "disposed"],
};
const CATEGORY_OPTIONS = {
  inventory: ["computer", "projector", "furniture", "lab_equipment", "sports_equipment", "stationery", "vehicle", "other"],
};
const SEVERITY_OPTIONS = ["info", "warning", "critical"];

/**
 * The filter controls for one export type. Which controls appear comes from the
 * server's `export_filters` map, so a type can gain a filter without touching
 * this component.
 */
function ExportFilters({ type, supported, value, onChange }) {
  const { options } = useFilterOptions();
  const has = (k) => supported.includes(k);
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  if (!supported.length) {
    return <p className="text-xs text-zinc-500">This export has no filters — it includes all records.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-50 p-3">
      {has("session_id") && (
        <select value={value.session_id || ""} onChange={set("session_id")} className={EXPORT_SELECT_CLS} aria-label="Session">
          <option value="">Current roster</option>
          {options.sessions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}{o.is_current ? " (current)" : ""}</option>
          ))}
        </select>
      )}
      {has("class_id") && (
        <select value={value.class_id || ""} onChange={set("class_id")} className={EXPORT_SELECT_CLS} aria-label="Class">
          <option value="">All classes</option>
          {options.classes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      {has("section") && (
        <select value={value.section || ""} onChange={set("section")} className={EXPORT_SELECT_CLS} aria-label="Section">
          <option value="">All sections</option>
          {options.sections.map((o) => <option key={o} value={o}>Section {o}</option>)}
        </select>
      )}
      {has("grade_level") && (
        <select value={value.grade_level || ""} onChange={set("grade_level")} className={EXPORT_SELECT_CLS} aria-label="Grade">
          <option value="">All grades</option>
          {options.grade_levels.map((o) => <option key={o} value={o}>Grade {o}</option>)}
        </select>
      )}
      {has("exam_id") && (
        <select value={value.exam_id || ""} onChange={set("exam_id")} className={EXPORT_SELECT_CLS} aria-label="Exam">
          <option value="">All exams</option>
          {options.exams.map((o) => (
            <option key={o.id} value={o.id}>{o.title}{o.class_name ? ` · ${o.class_name}` : ""}</option>
          ))}
        </select>
      )}
      {has("lifecycle_status") && (
        <select value={value.lifecycle_status || ""} onChange={set("lifecycle_status")} className={EXPORT_SELECT_CLS} aria-label="Lifecycle status">
          <option value="">Any status</option>
          {options.lifecycle_statuses.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {has("status") && (
        <select value={value.status || ""} onChange={set("status")} className={EXPORT_SELECT_CLS} aria-label="Status">
          <option value="">Any status</option>
          {(STATUS_OPTIONS[type] || []).map((o) => (
            <option key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</option>
          ))}
        </select>
      )}
      {has("category") && (
        <select value={value.category || ""} onChange={set("category")} className={EXPORT_SELECT_CLS} aria-label="Category">
          <option value="">All categories</option>
          {(CATEGORY_OPTIONS[type] || []).map((o) => (
            <option key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</option>
          ))}
        </select>
      )}
      {has("severity") && (
        <select value={value.severity || ""} onChange={set("severity")} className={EXPORT_SELECT_CLS} aria-label="Severity">
          <option value="">Any severity</option>
          {SEVERITY_OPTIONS.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}
        </select>
      )}
      {has("date_from") && (
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          From
          <input type="date" value={value.date_from || ""} onChange={set("date_from")} className={EXPORT_SELECT_CLS} />
        </label>
      )}
      {has("date_to") && (
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          To
          <input type="date" value={value.date_to || ""} onChange={set("date_to")} className={EXPORT_SELECT_CLS} />
        </label>
      )}
      {has("search") && (
        <input
          value={value.search || ""}
          onChange={set("search")}
          placeholder="Search…"
          className={`${EXPORT_SELECT_CLS} min-w-[180px]`}
        />
      )}
      {Object.values(value).some((v) => v) && (
        <button type="button" onClick={() => onChange({})} className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700">
          Reset
        </button>
      )}
    </div>
  );
}


/**
 * Target class / section / session for an import.
 *
 * Picking a class here means the CSV does not need a class_name column — the
 * common case is bulk-loading one class's roster from a sheet that only lists
 * names and roll numbers.
 */
function ImportDefaults({ type, value, onChange }) {
  const { options } = useFilterOptions();
  if (type !== "students") return null;
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  return (
    <>
      <label className="mb-1 block text-xs font-medium text-zinc-600">
        Target class, section &amp; session <span className="font-normal text-zinc-400">(optional)</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select value={value.default_class_id} onChange={set("default_class_id")} className={EXPORT_SELECT_CLS} aria-label="Target class">
          <option value="">Use class_name column</option>
          {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={value.default_section} onChange={set("default_section")} className={EXPORT_SELECT_CLS} aria-label="Target section">
          <option value="">Use section column</option>
          {options.sections.map((sec) => <option key={sec} value={sec}>Section {sec}</option>)}
        </select>
        <select value={value.session_id} onChange={set("session_id")} className={EXPORT_SELECT_CLS} aria-label="Target session">
          <option value="">Current session</option>
          {options.sessions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}{o.is_current ? " (current)" : ""}</option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function ImportsPage() {
  const [imports, setImports] = useState([]);
  const [exports, setExports] = useState([]);
  const [exportType, setExportType] = useState("students");
  // Defaults applied to rows that leave the column blank.
  const [importDefaults, setImportDefaults] = useState({ default_class_id: "", default_section: "", session_id: "" });
  const [exportFilters, setExportFilters] = useState({});
  const [types, setTypes] = useState({ import_types: [], export_types: [], required_columns: {} });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("import");
  const [importType, setImportType] = useState("students");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    const [imp, exp] = await Promise.all([
      apiFetch("/api/data/imports").catch(() => ({ imports: [] })),
      apiFetch("/api/data/exports").catch(() => ({ exports: [] })),
    ]);
    setImports(imp.imports || []);
    setExports(exp.exports || []);
  }, []);

  useEffect(() => {
    Promise.all([refresh(), apiFetch("/api/data/types").then(setTypes).catch(() => {})]).finally(() =>
      setLoading(false)
    );
  }, [refresh]);

  // Step 1 — validate and stage the file, showing a preview before anything is written.
  const stageImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Select a CSV file first");
    if (!file.name.toLowerCase().endsWith(".csv")) return toast.error("Only CSV files are supported");
    setBusy(true);
    try {
      const data = await apiUpload("/api/data/import", file, {
        type: importType,
        ...Object.fromEntries(Object.entries(importDefaults).filter(([, v]) => v)),
      });
      setPreview({ ...data, type: importType });
      toast.success(`${data.total_rows} row(s) ready to import`);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Step 2 — commit. The server queues a job, so the row is polled until it settles.
  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await apiFetch(`/api/data/import/${preview.import_id}/confirm`, { method: "POST" });
      toast.success("Import started");
      const settled = await pollImport(preview.import_id);
      if (settled) {
        toast[settled.failed_rows > 0 ? "error" : "success"](
          `Imported ${settled.imported_rows} of ${settled.total_rows} row(s)` +
            (settled.failed_rows ? `, ${settled.failed_rows} failed` : "")
        );
      }
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pollImport = async (id) => {
    for (let i = 0; i < 15; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1500));
      try {
        // eslint-disable-next-line no-await-in-loop
        const { import: row } = await apiFetch(`/api/data/imports/${id}`);
        if (row && ["completed", "failed"].includes(row.status)) return row;
      } catch {
        return null;
      }
    }
    return null;
  };

  const downloadTemplate = async (type) => {
    await downloadAuthed(`/api/data/import/template/${type}`, `${type}-template.csv`);
  };

  const startExport = async (type, filters = {}) => {
    setBusy(true);
    try {
      // Drop blank controls so the server only sees filters the user actually set.
      const active = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      const res = await apiFetch("/api/data/export", { method: "POST", body: { type, filters: active } });
      toast.success(res.export?.status === "completed" ? `${type} export ready` : `Export queued for ${type}`);
      await pollExport(res.export.id);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pollExport = async (id) => {
    for (let i = 0; i < 15; i++) {
      // eslint-disable-next-line no-await-in-loop
      const { exports: rows } = await apiFetch("/api/data/exports").catch(() => ({ exports: [] }));
      const row = rows?.find((e) => e.id === id);
      if (row && ["completed", "failed"].includes(row.status)) {
        setExports(rows);
        return row;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
  };

  const downloadExport = async (row) => {
    await downloadAuthed(`/api/data/exports/${row.id}/download`, `${row.type}.csv`);
  };

  /** Files come back as a protected response, so fetch with the token and save the blob. */
  const downloadAuthed = async (path, filename) => {
    try {
      const res = await fetch(`${apiBase()}${path}`, { headers: authHeaders() });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Download failed (${res.status})`;
        try {
          msg = JSON.parse(text).error || msg;
        } catch {
          /* keep the generic message */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const required = types.required_columns?.[importType] || [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <ArrowUpDown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Import / Export</h1>
            <p className="text-sm text-zinc-500">Bulk-load records from CSV or export school data.</p>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {["import", "export"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "import" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Upload CSV</h2>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Record type</label>
                <select
                  value={importType}
                  onChange={(e) => {
                    setImportType(e.target.value);
                    setPreview(null);
                  }}
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-sm capitalize focus:border-primary-500 focus:outline-none"
                >
                  {(types.import_types || []).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <ImportDefaults
                  type={importType}
                  value={importDefaults}
                  onChange={(v) => { setImportDefaults(v); setPreview(null); }}
                />
              </div>
              <button
                onClick={() => downloadTemplate(importType)}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <FileDown className="h-4 w-4" /> Download template
              </button>
            </div>

            {required.length > 0 && (
              <p className="mb-3 text-xs text-zinc-500">
                Required column{required.length > 1 ? "s" : ""}:{" "}
                <span className="font-mono text-zinc-700">{required.join(", ")}</span>
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={() => setPreview(null)}
              className="mb-4 block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
            />
            <button
              onClick={stageImport}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
            >
              {busy && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Validate &amp; preview
            </button>
          </div>

          {preview && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-6 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold text-zinc-900">
                Preview — {preview.total_rows} {preview.type} row(s)
              </h2>
              <p className="mb-4 text-xs text-zinc-500">First {preview.preview?.length || 0} row(s) shown.</p>
              <div className="mb-4 max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left font-semibold uppercase tracking-wider text-zinc-500">
                      {(preview.headers || []).map((h) => (
                        <th key={h} className="px-3 py-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(preview.preview || []).map((row, i) => (
                      <tr key={i}>
                        {(preview.headers || []).map((h) => (
                          <td key={h} className="px-3 py-2 text-zinc-700">
                            {row[h] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmImport}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Import {preview.total_rows} row(s)
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Import History</h2>
            </div>
            {loading ? (
              <Loading />
            ) : imports.length === 0 ? (
              <Empty>No imports yet.</Empty>
            ) : (
              <div className="divide-y divide-zinc-100">
                {imports.map((imp) => (
                  <div key={imp.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium capitalize text-zinc-800">{label(imp.type)}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(imp.created_at).toLocaleString()} &middot; {imp.total_rows ?? 0} rows &middot;{" "}
                          {imp.imported_rows ?? 0} imported
                          {imp.failed_rows ? `, ${imp.failed_rows} failed` : ""}
                          {imp.uploaded_by_name ? ` · by ${imp.uploaded_by_name}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS[imp.status] || STATUS.pending
                        }`}
                      >
                        {imp.status}
                      </span>
                    </div>
                    {Array.isArray(imp.errors) && imp.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" /> {imp.errors.length} row error(s)
                        </summary>
                        <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
                          {imp.errors.slice(0, 20).map((e, i) => (
                            <li key={i}>
                              Row {e.row}: {e.error}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Export Data</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Pick what to export, then narrow it down. Leaving a filter unset includes everything.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              {(types.export_types || []).map((type) => (
                <button
                  key={type}
                  onClick={() => { setExportType(type); setExportFilters({}); }}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-medium capitalize shadow-sm transition ${
                    exportType === type
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <ExportFilters
              type={exportType}
              supported={types.export_filters?.[exportType] || []}
              value={exportFilters}
              onChange={setExportFilters}
            />

            <button
              onClick={() => startExport(exportType, exportFilters)}
              disabled={busy}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export <span className="capitalize">{exportType}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Export History</h2>
            </div>
            {exports.length === 0 ? (
              <Empty>No exports yet.</Empty>
            ) : (
              <div className="divide-y divide-zinc-100">
                {exports.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium capitalize text-zinc-800">{label(exp.type)}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(exp.created_at).toLocaleString()} &middot; {String(exp.format || "csv").toUpperCase()}
                        {exp.requested_by_name ? ` · by ${exp.requested_by_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS[exp.status] || STATUS.pending
                        }`}
                      >
                        {exp.status}
                      </span>
                      {exp.status === "completed" && exp.file_id && (
                        <button
                          onClick={() => downloadExport(exp)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                        >
                          <Download className="h-3 w-3" /> Download
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading...
    </div>
  );
}

function Empty({ children }) {
  return <div className="py-12 text-center text-sm text-zinc-400">{children}</div>;
}
