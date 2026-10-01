"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { FolderOpen, Upload, Trash2, Loader2, Search, FileText, Download, BadgeCheck } from "lucide-react";
import { apiFetch, uploadFile, fetchFileObjectUrl } from "@/lib/api";

/** Mirrors the documents table CHECK constraints (migration 028). */
const CATEGORIES = [
  "admission",
  "identity",
  "transfer",
  "medical",
  "certificate",
  "report_card",
  "fee_receipt",
  "disciplinary",
  "parent_submitted",
  "other",
];

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

const label = (s) => String(s || "").replace(/_/g, " ");

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [students, setStudents] = useState([]);
  const [institutionId, setInstitutionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  // Where the next upload is filed. owner "" means the school itself.
  const [target, setTarget] = useState({ category: "other", student_id: "" });

  useEffect(() => {
    try {
      const inst = JSON.parse(localStorage.getItem("institution") || "null");
      if (inst?.id) setInstitutionId(inst.id);
    } catch {
      /* ignore unreadable storage */
    }
    apiFetch("/api/students?limit=1000")
      .then((d) => setStudents(d.students || []))
      .catch(() => {});
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (categoryFilter) params.set("category", categoryFilter);
      const data = await apiFetch(`/api/documents?${params}`);
      setDocs(data.documents || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ownerIsStudent = Boolean(target.student_id);
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "document");
      await apiFetch("/api/documents", {
        method: "POST",
        body: {
          owner_type: ownerIsStudent ? "student" : "institution",
          // Omitted for the school: the server fills in the caller's tenant.
          owner_id: ownerIsStudent ? target.student_id : institutionId || undefined,
          category: target.category,
          title: file.name,
          file_id: uploaded?.id || null,
          mime_type: file.type,
          file_size: file.size,
        },
      });
      toast.success("Document uploaded");
      fetchDocs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      setDocs((d) => d.filter((doc) => doc.id !== id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleVerify = async (doc, status) => {
    try {
      await apiFetch(`/api/documents/${doc.id}/verify`, {
        method: "PATCH",
        body: { status },
      });
      toast.success(`Marked ${status}`);
      fetchDocs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const download = async (doc) => {
    if (!doc.file_id) return toast.error("No file attached to this record");
    const url = await fetchFileObjectUrl(doc.file_id);
    if (!url) return toast.error("File unavailable");
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.title || "document";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const selectCls = "rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <FolderOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Documents</h1>
          <p className="text-sm text-zinc-500">Upload, verify and retrieve school and student documents.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Upload a document</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Category</label>
            <select
              value={target.category}
              onChange={(e) => setTarget((t) => ({ ...t, category: e.target.value }))}
              className={selectCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {label(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Belongs to</label>
            <select
              value={target.student_id}
              onChange={(e) => setTarget((t) => ({ ...t, student_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">The school</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.class_name ? ` — ${s.class_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choose file
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by title..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${selectCls} h-11`}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-zinc-400">
            <FileText className="mb-3 h-10 w-10" />
            <p className="text-sm">No documents found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Belongs to</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{doc.title || "Untitled"}</td>
                    <td className="px-4 py-3 capitalize text-zinc-500">{label(doc.category) || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {doc.owner_name || label(doc.owner_type) || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                      {doc.uploaded_by_name ? (
                        <span className="block text-xs text-zinc-400">by {doc.uploaded_by_name}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          STATUS_COLORS[doc.verification_status] || "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {doc.verification_status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {doc.file_id && (
                          <button
                            onClick={() => download(doc)}
                            title="Download"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        {doc.verification_status !== "verified" && (
                          <button
                            onClick={() => handleVerify(doc, "verified")}
                            title="Mark verified"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <BadgeCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          title="Delete"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
