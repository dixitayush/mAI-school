"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, X } from "lucide-react";
import toast from "react-hot-toast";
import { uploadFile } from "@/lib/api";

/**
 * Generic file picker that uploads to Postgres-backed /api/files and reports
 * the resulting file id via onUploaded({ id, filename, ... }).
 */
export default function FileUpload({
  kind = "generic",
  accept,
  label = "Upload file",
  onUploaded,
  className = "",
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const saved = await uploadFile(file, kind);
      setDone(saved);
      onUploaded?.(saved);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handlePick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {busy ? "Uploading…" : done ? "Uploaded" : label}
      </button>
      {done && (
        <span className="ml-3 inline-flex items-center gap-1 text-xs text-zinc-500">
          {done.filename}
          <button type="button" onClick={() => setDone(null)} aria-label="clear">
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
    </div>
  );
}
