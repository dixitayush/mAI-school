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
  resolveSchoolBrand,
  safeFileName,
  tableThemeStyles,
} from "./pdfUtils";

/**
 * Generate a comprehensive student report card as PDF
 * @param {Object} studentData - Student data including personal info, marks, and attendance
 */
export function generateReportCard(studentData) {
  const doc = new jsPDF();
  const brand = resolveSchoolBrand(studentData);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const yearLabel = academicYearLabel();

  let y = drawDocumentHeader(doc, {
    title: "STUDENT REPORT CARD",
    subtitle: `Academic Year ${yearLabel}`,
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "Student Information", y);

  const studentInfo = [
    ["Student Name", studentData.name || "N/A"],
    ["Class", studentData.class || "N/A"],
    ["Roll Number", studentData.rollNumber || "N/A"],
    ["Academic Year", yearLabel],
    ["School", brand.name],
  ];

  autoTable(doc, {
    startY: y,
    body: studentInfo,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3, textColor: PDF_THEME.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40, textColor: PDF_THEME.muted },
      1: { cellWidth: "auto" },
    },
  });

  y = drawSectionTitle(doc, "Academic Performance", doc.lastAutoTable.finalY + 12);

  const marksData = (studentData.results || []).map((result) => {
    const percentage =
      result.totalMarks > 0
        ? ((result.marksObtained / result.totalMarks) * 100).toFixed(1)
        : "0.0";
    return [
      result.subject,
      String(result.marksObtained),
      String(result.totalMarks),
      percentage + "%",
      result.grade || calculateGrade(percentage),
    ];
  });

  if (marksData.length > 0) {
    const totalObtained = studentData.results.reduce((sum, r) => sum + r.marksObtained, 0);
    const totalMax = studentData.results.reduce((sum, r) => sum + r.totalMarks, 0);
    const overallPercentage =
      totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "0.0";

    marksData.push([
      "TOTAL",
      String(totalObtained),
      String(totalMax),
      overallPercentage + "%",
      calculateGrade(overallPercentage),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Subject", "Marks Obtained", "Total Marks", "Percentage", "Grade"]],
    body: marksData.length > 0 ? marksData : [["No exam results available", "", "", "", ""]],
    ...tableThemeStyles(),
    styles: {
      ...tableThemeStyles().styles,
      fontSize: 9,
      cellPadding: 4,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
    },
    didParseCell(cellData) {
      if (cellData.row.index === marksData.length - 1 && marksData.length > 1) {
        cellData.cell.styles.fillColor = PDF_THEME.primarySoft;
        cellData.cell.styles.textColor = PDF_THEME.primaryDeep;
        cellData.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = doc.lastAutoTable.finalY + 14;

  if (y > pageHeight - 90) {
    doc.addPage();
    y = 20;
  }

  y = drawSectionTitle(doc, "Attendance Summary", y);

  autoTable(doc, {
    startY: y,
    body: [
      ["Total Days", String(studentData.totalDays || 0)],
      ["Present", String(studentData.presentDays || 0)],
      ["Absent", String(studentData.absentDays || 0)],
      ["Attendance Percentage", `${studentData.attendancePercentage || "0"}%`],
    ],
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: PDF_THEME.text,
      lineColor: PDF_THEME.border,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: PDF_THEME.primarySoft },
      1: { cellWidth: "auto", halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 12;

  if (studentData.overallGrade || studentData.remarks) {
    y = drawSectionTitle(doc, "Overall Performance", y);
    doc.setFontSize(10);
    doc.setTextColor(...PDF_THEME.text);
    if (studentData.overallGrade) {
      doc.setFont(undefined, "bold");
      doc.text(`Grade: ${studentData.overallGrade}`, 14, y);
      y += 7;
    }
    if (studentData.remarks) {
      doc.setFont(undefined, "italic");
      doc.setTextColor(...PDF_THEME.muted);
      doc.text(`Remarks: ${studentData.remarks}`, 14, y, { maxWidth: pageWidth - 28 });
      y += 12;
    }
    doc.setFont(undefined, "normal");
    doc.setTextColor(...PDF_THEME.text);
  }

  const sigY = Math.min(y + 20, pageHeight - 40);
  drawSignaturePair(doc, sigY, "Class Teacher", "Principal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(`Issue Date: ${formatPdfDate(new Date())}`, pageWidth / 2, sigY + 5, {
    align: "center",
  });

  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: "Official academic record — issued by the institution.",
  });

  doc.save(
    safeFileName(
      `report-card-${studentData.name || "student"}-${new Date().toISOString().split("T")[0]}`
    )
  );
}

function calculateGrade(percentage) {
  const percent = parseFloat(percentage);
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B+";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  if (percent >= 40) return "D";
  return "F";
}
