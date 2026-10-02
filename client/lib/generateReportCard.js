import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_THEME,
  drawDocumentFooters,
  drawDocumentHeader,
  drawSectionTitle,
  drawSignaturePair,
  formatPdfDate,
  resolveSchoolBrand,
  safeFileName,
  tableThemeStyles,
} from "./pdfUtils";

/** "10-B" with section "B" stays "10-B"; "10" with section "B" becomes "10 · B". */
export function classLabel(className, section) {
  if (!className) return "";
  if (!section || String(className).toUpperCase().endsWith(`-${String(section).toUpperCase()}`)) return className;
  return `${className} · ${section}`;
}

const pct = (obtained, total) => (total > 0 ? (obtained / total) * 100 : 0);

export function gradeFor(percentage) {
  const p = Number(percentage);
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B+";
  if (p >= 60) return "B";
  if (p >= 50) return "C";
  if (p >= 40) return "D";
  return "F";
}

/**
 * Totals for a report card, shared by the PDF and the on-screen preview so both
 * show the same numbers.
 */
export function summarizeReportCard(card) {
  const results = card?.results || [];
  const obtained = results.reduce((sum, r) => sum + Number(r.marks_obtained || 0), 0);
  const max = results.reduce((sum, r) => sum + Number(r.total_marks || 0), 0);
  const percentage = pct(obtained, max);
  const failed = results.filter((r) => Number(r.marks_obtained) < Number(r.passing_marks));
  return {
    obtained,
    max,
    percentage,
    grade: results.length ? gradeFor(percentage) : "—",
    passed: results.length > 0 && failed.length === 0,
    failedSubjects: [...new Set(failed.map((r) => r.subject))],
  };
}

/**
 * Report card PDF for one session — either a single exam, or (card.exam null)
 * the whole session with every exam side by side.
 *
 * @param {Object} card the /api/students/:id/report-card response
 */
export function generateReportCard(card) {
  const doc = new jsPDF();
  const brand = resolveSchoolBrand({ schoolName: card.school?.name, schoolSlug: card.school?.slug });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const { student, session } = card;
  const scope = card.exam || "Full Session";
  const summary = summarizeReportCard(card);

  let y = drawDocumentHeader(doc, {
    title: "STUDENT REPORT CARD",
    subtitle: `Academic Session ${session.name} · ${scope}`,
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "Student Information", y);
  const info = [
    ["Student Name", student.full_name, "Registration ID", student.registration_id],
    ["Class", classLabel(student.class_name, student.section), "Roll Number", student.roll_number],
    ["Session", session.name, "Examination", scope],
  ];
  autoTable(doc, {
    startY: y,
    body: info.map((row) => row.map((v) => (v ? String(v) : "—"))),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2.5, textColor: PDF_THEME.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 34, textColor: PDF_THEME.muted },
      1: { cellWidth: 58 },
      2: { fontStyle: "bold", cellWidth: 34, textColor: PDF_THEME.muted },
      3: { cellWidth: "auto" },
    },
  });

  y = drawSectionTitle(doc, "Academic Performance", doc.lastAutoTable.finalY + 10);

  const results = card.results || [];
  let head;
  let body;
  if (card.exam) {
    head = [["Subject", "Max", "Pass", "Obtained", "%", "Grade", "Result"]];
    body = results.map((r) => {
      const p = pct(r.marks_obtained, r.total_marks);
      return [
        r.subject,
        String(r.total_marks),
        String(r.passing_marks),
        String(r.marks_obtained),
        `${p.toFixed(1)}%`,
        r.grade || gradeFor(p),
        Number(r.marks_obtained) >= Number(r.passing_marks) ? "Pass" : "Fail",
      ];
    });
    if (results.length) {
      body.push([
        "TOTAL", String(summary.max), "", String(summary.obtained),
        `${summary.percentage.toFixed(1)}%`, summary.grade, summary.passed ? "Pass" : "Fail",
      ]);
    }
  } else {
    // Subjects down the side, each exam across the top, then the session total.
    const exams = card.exams || [];
    const subjects = [...new Set(results.map((r) => r.subject))];
    const cell = (subject, title) => results.find((r) => r.subject === subject && r.title === title);
    head = [["Subject", ...exams, "Total", "%", "Grade"]];
    body = subjects.map((subject) => {
      const rows = results.filter((r) => r.subject === subject);
      const got = rows.reduce((s, r) => s + Number(r.marks_obtained), 0);
      const max = rows.reduce((s, r) => s + Number(r.total_marks), 0);
      const p = pct(got, max);
      return [
        subject,
        ...exams.map((t) => {
          const r = cell(subject, t);
          return r ? `${r.marks_obtained}/${r.total_marks}` : "—";
        }),
        `${got}/${max}`,
        `${p.toFixed(1)}%`,
        gradeFor(p),
      ];
    });
    if (results.length) {
      body.push([
        "TOTAL",
        ...exams.map((t) => {
          const rows = results.filter((r) => r.title === t);
          const got = rows.reduce((s, r) => s + Number(r.marks_obtained), 0);
          const max = rows.reduce((s, r) => s + Number(r.total_marks), 0);
          return `${got}/${max}`;
        }),
        `${summary.obtained}/${summary.max}`,
        `${summary.percentage.toFixed(1)}%`,
        summary.grade,
      ]);
    }
  }

  const columnCount = head[0].length;
  autoTable(doc, {
    startY: y,
    head,
    body: body.length ? body : [["No exam results recorded", ...Array(columnCount - 1).fill("")]],
    ...tableThemeStyles(),
    styles: {
      ...tableThemeStyles().styles,
      fontSize: columnCount > 7 ? 8 : 9,
      cellPadding: 3.5,
      halign: "center",
    },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    didParseCell(cellData) {
      if (cellData.section !== "body") return;
      if (results.length && cellData.row.index === body.length - 1) {
        cellData.cell.styles.fillColor = PDF_THEME.primarySoft;
        cellData.cell.styles.textColor = PDF_THEME.primaryDeep;
        cellData.cell.styles.fontStyle = "bold";
      } else if (cellData.cell.raw === "Fail") {
        cellData.cell.styles.textColor = [185, 28, 28];
        cellData.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = doc.lastAutoTable.finalY + 12;
  if (y > pageHeight - 110) {
    doc.addPage();
    y = 20;
  }

  y = drawSectionTitle(doc, "Result & Attendance", y);
  const att = card.attendance || {};
  autoTable(doc, {
    startY: y,
    body: [
      ["Overall", `${summary.obtained} / ${summary.max}  (${summary.percentage.toFixed(1)}%)`, "Working Days", String(att.working ?? 0)],
      ["Grade", summary.grade, "Present", String(att.present ?? 0)],
      [
        "Result",
        results.length ? (summary.passed ? "PASS" : `NEEDS IMPROVEMENT (${summary.failedSubjects.join(", ")})`) : "—",
        "Absent",
        String(att.absent ?? 0),
      ],
      ["Period", `${formatPdfDate(card.period?.from)} – ${formatPdfDate(card.period?.to)}`, "Attendance", `${Number(att.percentage ?? 0).toFixed(1)}%`],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3.5, textColor: PDF_THEME.text, lineColor: PDF_THEME.border, lineWidth: 0.2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26, fillColor: PDF_THEME.primarySoft },
      1: { cellWidth: 84 },
      2: { fontStyle: "bold", cellWidth: 32, fillColor: PDF_THEME.primarySoft },
      3: { cellWidth: "auto", halign: "center" },
    },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Teachers' remarks, where any were entered with the marks.
  const remarks = results.filter((r) => r.feedback).map((r) => [`${r.subject}${card.exam ? "" : ` (${r.title})`}`, r.feedback]);
  if (remarks.length) {
    if (y > pageHeight - 80) { doc.addPage(); y = 20; }
    y = drawSectionTitle(doc, "Teacher's Remarks", y);
    autoTable(doc, {
      startY: y,
      body: remarks,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2.5, textColor: PDF_THEME.text },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50, textColor: PDF_THEME.muted } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const sigY = Math.min(Math.max(y + 18, pageHeight - 60), pageHeight - 40);
  drawSignaturePair(doc, sigY, "Class Teacher", "Principal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(`Issue Date: ${formatPdfDate(new Date())}`, pageWidth / 2, sigY + 5, { align: "center" });

  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: "Official academic record — issued by the institution.",
  });

  doc.save(
    safeFileName(`report-card-${student.registration_id || student.full_name}-${session.name}-${scope}`)
  );
}
