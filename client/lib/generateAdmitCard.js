import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { imageFormatOf, safeFileName } from "./pdfUtils";

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
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont(undefined, "bold");
  doc.text(data.schoolName || "MAI School", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(14);
  doc.text("EXAM ADMIT CARD", pageWidth / 2, 30, { align: "center" });

  doc.setTextColor(0, 0, 0);

  // Optional student photo box (top-right)
  if (data.photoDataUrl) {
    try {
      doc.addImage(
        data.photoDataUrl,
        imageFormatOf(data.photoDataUrl),
        pageWidth - 50,
        50,
        32,
        38
      );
    } catch {
      /* ignore bad image */
    }
  }
  doc.setDrawColor(200, 200, 200);
  doc.rect(pageWidth - 50, 50, 32, 38);

  const info = [
    ["Student Name", data.studentName || "N/A"],
    ["Roll Number", data.rollNumber || "N/A"],
    ["Class", [data.className, data.section].filter(Boolean).join(" - ") || "N/A"],
    ["Exam", data.examTitle || "N/A"],
    ["Subject", data.subject || "N/A"],
    [
      "Date",
      data.examDate
        ? new Date(data.examDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A",
    ],
  ];

  autoTable(doc, {
    startY: 55,
    margin: { right: 60 },
    body: info,
    theme: "plain",
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45 },
      1: { cellWidth: "auto" },
    },
  });

  let y = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "This admit card must be presented at the examination hall. Eligibility verified by the institution.",
    14,
    y,
    { maxWidth: pageWidth - 28 }
  );

  y += 30;
  doc.setTextColor(80, 80, 80);
  doc.text("_________________", 20, y);
  doc.text("Student Signature", 20, y + 5);
  doc.text("_________________", pageWidth - 70, y);
  doc.text("Controller of Exams", pageWidth - 70, y + 5);

  if (!docRef && save) {
    doc.save(safeFileName(`admit-card-${data.studentName || "student"}`));
  }
  return doc;
}

/** Generate one multi-page PDF with an admit card per student. */
export function generateAdmitCardsBulk(cards, fileName = "admit-cards") {
  if (!cards || cards.length === 0) return;
  const doc = new jsPDF();
  cards.forEach((c, i) => {
    if (i > 0) doc.addPage();
    generateAdmitCard(c, doc, false);
  });
  doc.save(safeFileName(fileName));
}
