/**
 * Shared helpers for the jsPDF generators.
 *
 * Note on autoTable: jspdf-autotable v5 only patches `jsPDF.API` when jsPDF is
 * a browser global, which never happens under bundled ESM. Always import the
 * function and call `autoTable(doc, opts)` — `doc.autoTable(opts)` is undefined.
 */

/** Strip path separators and characters that break downloads on Windows/macOS. */
export function safeFileName(name, extension = "pdf") {
  const cleaned = String(name || "document")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 120);
  return `${cleaned || "document"}.${extension}`;
}

/** jsPDF needs the image format up front; data URLs carry it in their MIME type. */
export function imageFormatOf(dataUrl) {
  const mime = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl || "")?.[1]?.toLowerCase();
  if (mime === "png") return "PNG";
  if (mime === "webp") return "WEBP";
  return "JPEG";
}
