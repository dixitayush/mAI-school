import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_THEME,
  academicYearLabel,
  drawDocumentFooters,
  drawDocumentHeader,
  drawSectionTitle,
  drawSignaturePair,
  formatPdfDate,
  imageFormatOf,
  resolveSchoolBrand,
  safeFileName,
} from "./pdfUtils";

/**
 * Generate an exam admit card PDF.
 * @param {Object} data
 * @param {string} data.schoolName
 * @param {string} data.examTitle
 * @param {string} data.subject
 * @param {string} data.examDate
 * @param {string} data.studentName
 * @param {string} [data.rollNumber]
 * @param {string} [data.className]
 * @param {string} [data.section]
 * @param {string} [data.photoDataUrl] base64/data-URL of the student photo
 * @param {jsPDF} [docRef] reuse an existing doc (for bulk/multi-page)
 * @param {boolean} [save=true] save the file when standalone
 */
export function generateAdmitCard(data, docRef = null, save = true) {
  const doc = docRef || new jsPDF();
  const brand = resolveSchoolBrand(data);
  const pageWidth = doc.internal.pageSize.width;

  let y = drawDocumentHeader(doc, {
    title: "EXAM ADMIT CARD",
    subtitle: `Academic Year ${academicYearLabel()}`,
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "Candidate Details", y);

  if (data.photoDataUrl) {
    try {
      doc.addImage(
        data.photoDataUrl,
        imageFormatOf(data.photoDataUrl),
        pageWidth - 50,
        y,
        32,
        38
      );
    } catch {
      /* ignore bad image */
    }
  }
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.4);
  doc.rect(pageWidth - 50, y, 32, 38);
  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text("Photo", pageWidth - 34, y + 42, { align: "center" });
  doc.setTextColor(...PDF_THEME.text);

  const info = [
    ["Student Name", data.studentName || "N/A"],
    ["Roll Number", data.rollNumber || "N/A"],
    ["Class / Section", [data.className, data.section].filter(Boolean).join(" — ") || "N/A"],
    ["Examination", data.examTitle || "N/A"],
    ["Subject", data.subject || "N/A"],
    ["Exam Date", formatPdfDate(data.examDate)],
    ["School", brand.name],
  ];

  autoTable(doc, {
    startY: y,
    margin: { right: 60 },
    body: info,
    theme: "plain",
    styles: { fontSize: 11, cellPadding: 3, textColor: PDF_THEME.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: PDF_THEME.muted },
      1: { cellWidth: "auto" },
    },
  });

  y = doc.lastAutoTable.finalY + 14;
  doc.setFillColor(...PDF_THEME.primarySoft);
  doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.primaryDeep);
  doc.text(
    "This admit card must be presented at the examination hall. Eligibility has been verified by the institution.",
    18,
    y + 11,
    { maxWidth: pageWidth - 36 }
  );

  y += 36;
  drawSignaturePair(doc, y, "Student Signature", "Controller of Exams");

  if (!docRef) {
    drawDocumentFooters(doc, {
      schoolName: brand.name,
      schoolSlug: brand.slug,
      note: "Official examination document — retain for records.",
    });
    if (save) {
      doc.save(safeFileName(`admit-card-${data.studentName || "student"}`));
    }
  }
  return doc;
}

/** Generate one multi-page PDF with an admit card per student. */
export function generateAdmitCardsBulk(cards, fileName = "admit-cards") {
  if (!cards || cards.length === 0) return;
  const doc = new jsPDF();
  const brand = resolveSchoolBrand(cards[0] || {});
  cards.forEach((c, i) => {
    if (i > 0) doc.addPage();
    generateAdmitCard(c, doc, false);
  });
  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: "Official examination document — retain for records.",
  });
  doc.save(safeFileName(fileName));
}
