/**
 * Shared helpers for the jsPDF generators.
 *
 * Colors match client/app/globals.css (sage-green primary), not the old indigo.
 *
 * Note on autoTable: jspdf-autotable v5 only patches `jsPDF.API` when jsPDF is
 * a browser global, which never happens under bundled ESM. Always import the
 * function and call `autoTable(doc, opts)` — `doc.autoTable(opts)` is undefined.
 */

/** UI theme → RGB triples for jsPDF */
export const PDF_THEME = {
  primary: [111, 163, 113], // --primary-600 #6FA371
  primaryDark: [77, 124, 120], // --primary-700 #4d7c78
  primaryDeep: [22, 101, 52], // --primary-800 #166534
  primarySoft: [232, 245, 233], // --accent-light #E8F5E9
  accent: [200, 230, 201], // --accent #C8E6C9
  text: [31, 41, 55], // --text-primary #1F2937
  muted: [107, 114, 128], // --text-secondary #6B7280
  border: [229, 231, 235], // --border-light #E5E7EB
  surface: [245, 247, 250], // --bg-primary #F5F7FA
  altRow: [249, 250, 251], // --bg-tertiary #F9FAFB
  white: [255, 255, 255],
  successBg: [240, 253, 244],
  successBorder: [187, 247, 208],
  successText: [21, 128, 61],
};

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

/** Pull school branding from overrides or localStorage `institution`. */
export function resolveSchoolBrand(overrides = {}) {
  let stored = null;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("institution");
      if (raw && raw !== "null") stored = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  const name = overrides.schoolName || overrides.name || stored?.name || "MAI School";
  const slug = overrides.schoolSlug || overrides.slug || stored?.slug || "";
  const logoUrl = overrides.logoUrl || overrides.logo_url || stored?.logo_url || "";
  return {
    name,
    slug,
    logoUrl,
    tagline: overrides.tagline || (slug ? `Institute · ${slug}` : "School Management System"),
  };
}

export function formatPdfDate(value, withTime = false) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function academicYearLabel(date = new Date()) {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1; // Apr–Mar academic year
  return `${start}–${start + 1}`;
}

/**
 * Professional branded header used by every document.
 * Returns the Y position where body content should start.
 */
export function drawDocumentHeader(doc, { title, subtitle, schoolName, schoolSlug, logoUrl } = {}) {
  const brand = resolveSchoolBrand({ schoolName, schoolSlug, logoUrl });
  const pageWidth = doc.internal.pageSize.width;
  const headerH = 42;

  doc.setFillColor(...PDF_THEME.primary);
  doc.rect(0, 0, pageWidth, headerH, "F");
  doc.setFillColor(...PDF_THEME.primaryDark);
  doc.rect(0, headerH - 3, pageWidth, 3, "F");

  doc.setTextColor(...PDF_THEME.white);
  doc.setFont(undefined, "bold");
  doc.setFontSize(18);
  doc.text(brand.name, 14, 16);

  doc.setFont(undefined, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.accent);
  doc.text(brand.tagline, 14, 23);

  doc.setTextColor(...PDF_THEME.white);
  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  doc.text(title || "Document", pageWidth - 14, 16, { align: "right" });

  if (subtitle) {
    doc.setFont(undefined, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.accent);
    doc.text(String(subtitle), pageWidth - 14, 23, { align: "right" });
  }

  doc.setTextColor(...PDF_THEME.text);
  doc.setFont(undefined, "normal");
  return headerH + 10;
}

/** Thin accent rule + section heading. */
export function drawSectionTitle(doc, text, y) {
  doc.setFillColor(...PDF_THEME.primary);
  doc.rect(14, y - 4, 2.5, 8, "F");
  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_THEME.text);
  doc.text(text, 20, y + 2);
  doc.setFont(undefined, "normal");
  return y + 8;
}

/** Shared autoTable head/row styles matching the UI. */
export function tableThemeStyles() {
  return {
    theme: "grid",
    headStyles: {
      fillColor: PDF_THEME.primary,
      textColor: PDF_THEME.white,
      fontSize: 9.5,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9.5,
      cellPadding: 3,
      textColor: PDF_THEME.text,
      lineColor: PDF_THEME.border,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: PDF_THEME.altRow },
  };
}

/** Label / value meta grid (two columns of pairs). */
export function drawMetaBlock(doc, left, right, startY, autoTable) {
  autoTable(doc, {
    startY,
    body: left.map((row, i) => [...row, ...(right[i] || ["", ""])]),
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8, textColor: PDF_THEME.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 28, textColor: PDF_THEME.muted },
      1: { cellWidth: 60 },
      2: { fontStyle: "bold", cellWidth: 28, textColor: PDF_THEME.muted },
      3: { cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

/**
 * Footer on every page: school name, generated stamp, page x of y.
 * Call after all pages are built.
 */
export function drawDocumentFooters(doc, { schoolName, schoolSlug, note } = {}) {
  const brand = resolveSchoolBrand({ schoolName, schoolSlug });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const total = doc.internal.getNumberOfPages();
  const stamp = formatPdfDate(new Date(), true);

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_THEME.border);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_THEME.muted);
    doc.setFont(undefined, "normal");
    doc.text(brand.name, 14, pageHeight - 10);
    doc.text(`Generated ${stamp}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.text(`Page ${i} of ${total}`, pageWidth - 14, pageHeight - 10, { align: "right" });

    if (note && i === total) {
      doc.setFontSize(7);
      doc.text(note, 14, pageHeight - 5, { maxWidth: pageWidth - 28 });
    }
  }
}

/** Signature line pair used on admit cards / report cards. */
export function drawSignaturePair(doc, y, leftLabel, rightLabel) {
  const pageWidth = doc.internal.pageSize.width;
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.4);
  doc.line(20, y, 70, y);
  doc.line(pageWidth - 70, y, pageWidth - 20, y);
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(leftLabel, 20, y + 5);
  doc.text(rightLabel, pageWidth - 70, y + 5);
  doc.setTextColor(...PDF_THEME.text);
}
