"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ArrowUpDown, Upload, Download, Loader2 } from "lucide-react";
import { apiFetch, apiUpload } from "@/lib/api";

export default function ImportsPage() {
  const [imports, setImports] = useState([]);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState("import");
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/data/imports").catch(() => ({ imports: [] })),
      apiFetch("/api/data/exports").catch(() => ({ exports: [] })),
    ]).then(([imp, exp]) => {
      setImports(imp.imports || []);
      setExports(exp.exports || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleImport = async (entity) => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Select a CSV file first");
    if (!file.name.endsWith(".csv")) return toast.error("Only CSV files supported");
    setUploading(entity);
    try {
      const data = await apiUpload(`/api/data/import`, file, { type: entity });
      toast.success(`Imported ${data.imported ?? 0} ${entity}`);
      const imp = await apiFetch("/api/data/imports").catch(() => ({ imports: [] }));
      setImports(imp.imports || []);
      fileRef.current.value = "";
    } catch (err) { toast.error(err.message); }
    finally { setUploading(null); }
  };

  const handleExport = async (entity) => {
    setExporting(true);
    try {
      await apiFetch("/api/data/export", { method: "POST", body: { entity } });
      toast.success(`Export started for ${entity}`);
      const exp = await apiFetch("/api/data/exports").catch(() => ({ exports: [] }));
      setExports(exp.exports || []);
    } catch (err) { toast.error(err.message); }
    finally { setExporting(false); }
  };

  const STATUS = { completed: "bg-emerald-100 text-emerald-800", pending: "bg-amber-100 text-amber-800", failed: "bg-red-100 text-red-800", processing: "bg-blue-100 text-blue-800" };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><ArrowUpDown className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Import / Export</h1>
          <p className="text-sm text-zinc-500">Bulk import data via CSV or export school records.</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {["import", "export"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            {t === "import" ? "Import" : "Export"}
          </button>
        ))}
      </div>

      {tab === "import" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Upload CSV</h2>
            <input ref={fileRef} type="file" accept=".csv" className="mb-4 block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100" />
            <div className="flex flex-wrap gap-3">
              {["students", "teachers"].map(entity => (
                <button key={entity} onClick={() => handleImport(entity)} disabled={!!uploading} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60">
                  {uploading === entity ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import {entity}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4"><h2 className="text-lg font-semibold text-zinc-900">Import History</h2></div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
            ) : imports.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400">No imports yet.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {imports.map(imp => (
                  <div key={imp.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{imp.entity || imp.filename}</p>
                      <p className="text-xs text-zinc-500">{new Date(imp.created_at).toLocaleString()} &middot; {imp.row_count ?? "?"} rows</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[imp.status] || STATUS.pending}`}>{imp.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Export Data</h2>
            <div className="flex flex-wrap gap-3">
              {["students", "teachers", "fees", "attendance"].map(entity => (
                <button key={entity} onClick={() => handleExport(entity)} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60">
                  <Download className="h-4 w-4" /> Export {entity}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4"><h2 className="text-lg font-semibold text-zinc-900">Export History</h2></div>
            {exports.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400">No exports yet.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {exports.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{exp.entity}</p>
                      <p className="text-xs text-zinc-500">{new Date(exp.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[exp.status] || STATUS.pending}`}>{exp.status}</span>
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
