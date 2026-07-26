import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatInr } from "./currency";
import {
  PDF_THEME,
  academicYearLabel,
  drawDocumentFooters,
  drawDocumentHeader,
  drawSectionTitle,
  formatPdfDate,
  resolveSchoolBrand,
  safeFileName,
  tableThemeStyles,
} from "./pdfUtils";

/**
 * Generate a comprehensive dashboard report as PDF
 * @param {Object} data - Dashboard data including stats and charts
 */
export function generateDashboardReport(data) {
  const doc = new jsPDF();
  const brand = resolveSchoolBrand(data);
  const pageHeight = doc.internal.pageSize.height;

  let y = drawDocumentHeader(doc, {
    title: "DASHBOARD REPORT",
    subtitle: `AY ${academicYearLabel()} · ${formatPdfDate(new Date(), true)}`,
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "School Overview", y);

  const statsData = [
    ["Total Students", String(data?.students || 0)],
    ["Active Teachers", String(data?.teachers || 0)],
    ["Total Revenue", formatInr(data?.revenue || 0)],
    ["Average Attendance", String(data?.attendance || "0%")],
    ["Institution", brand.name],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: statsData,
    ...tableThemeStyles(),
    styles: { ...tableThemeStyles().styles, fontSize: 10, cellPadding: 5 },
  });

  y = doc.lastAutoTable.finalY + 14;

  if (data?.feeBreakdown && data.feeBreakdown.length > 0) {
    y = drawSectionTitle(doc, "Fee Collection Status", y);

    const feeData = data.feeBreakdown.map((item) => [
      item.name,
      String(item.value),
      data.totalFees
        ? `${((item.value / data.totalFees) * 100).toFixed(1)}%`
        : "0%",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Status", "Count", "Percentage"]],
      body: feeData,
      ...tableThemeStyles(),
      styles: { ...tableThemeStyles().styles, fontSize: 10, cellPadding: 5 },
    });

    y = doc.lastAutoTable.finalY + 14;
  }

  if (data?.attendanceData && data.attendanceData.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    y = drawSectionTitle(doc, "Attendance Trends (Monthly)", y);

    autoTable(doc, {
      startY: y,
      head: [["Month", "Attendance Rate"]],
      body: data.attendanceData.map((item) => [item.month, `${item.rate}%`]),
      ...tableThemeStyles(),
      styles: { ...tableThemeStyles().styles, fontSize: 10, cellPadding: 5 },
    });
  }

  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: "Confidential — for authorised school administrators only.",
  });

  doc.save(safeFileName(`dashboard-report-${new Date().toISOString().split("T")[0]}`));
}
