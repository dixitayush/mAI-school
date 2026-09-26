"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { FolderOpen, Upload, Trash2, Loader2, Search, FileText } from "lucide-react";
import { apiFetch, uploadFile } from "@/lib/api";

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const data = await apiFetch(`/api/documents?${params}`);
      setDocs(data.documents || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "document");
      await apiFetch("/api/documents", {
        method: "POST",
        body: {
          owner_type: "institution",
          owner_id: "self",
          category: "general",
          title: file.name,
          file_id: uploaded?.id || uploaded?.file_id || null,
          mime_type: file.type,
          file_size: file.size,
        },
      });
      toast.success("Document uploaded");
      fetchDocs();
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      setDocs((d) => d.filter((doc) => doc.id !== id));
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <FolderOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Documents</h1>
            <p className="text-sm text-zinc-500">Manage student and school documents.</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..."
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-zinc-400">
            <FileText className="mb-3 h-10 w-10" />
            <p className="text-sm">No documents found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Uploaded</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-800">{doc.title || doc.filename || "Untitled"}</td>
                    <td className="px-4 py-3 text-zinc-500 capitalize">{doc.category || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{doc.owner_type || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(doc.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
