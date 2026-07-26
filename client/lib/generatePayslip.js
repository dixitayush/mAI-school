import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAmount } from "./currency";
import {
  PDF_THEME,
  drawDocumentFooters,
  drawDocumentHeader,
  drawSectionTitle,
  formatPdfDate,
  resolveSchoolBrand,
  safeFileName,
  tableThemeStyles,
} from "./pdfUtils";

const MONTH = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "-";

// PostGraphile runs with dynamicJson off, so jsonb columns arrive as strings.
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salary slip PDF.
 * @param {Object} data
 * @param {Array<{name:string, type:'earning'|'deduction', amount:number}>} data.components
 */
export function generatePayslip(data) {
  const doc = new jsPDF();
  const brand = resolveSchoolBrand(data);
  const pageWidth = doc.internal.pageSize.width;

  let y = drawDocumentHeader(doc, {
    title: "SALARY SLIP",
    subtitle: MONTH(data.periodMonth),
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "Employee Details", y);

  autoTable(doc, {
    startY: y,
    body: [
      ["Employee", data.employeeName || "-", "Designation", data.designation || "Staff"],
      ["Employee ID", data.employeeCode || "-", "Payment Mode", data.paymentMode || "Bank Transfer"],
      ["Bank A/C", data.accountNumber || "-", "IFSC", data.ifscCode || "-"],
      ["PAN", data.panNumber || "-", "UAN / PF", data.pfNumber || "-"],
      [
        "Working Days",
        String(data.workingDays ?? "-"),
        "Paid Days",
        `${data.paidDays ?? "-"}${Number(data.lopDays) > 0 ? `  (LOP ${data.lopDays})` : ""}`,
      ],
      ["School", brand.name, "Period", MONTH(data.periodMonth)],
    ],
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8, textColor: PDF_THEME.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 30, textColor: PDF_THEME.muted },
      1: { cellWidth: 58 },
      2: { fontStyle: "bold", cellWidth: 30, textColor: PDF_THEME.muted },
      3: { cellWidth: "auto" },
    },
  });

  const components = asArray(data.components);
  const earnings = components.filter((c) => c.type === "earning");
  const deductions = components.filter((c) => c.type === "deduction");
  const gross = earnings.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalDed = deductions.reduce((s, c) => s + Number(c.amount || 0), 0);

  const rowCount = Math.max(earnings.length, deductions.length, 1);
  const rows = Array.from({ length: rowCount }, (_, i) => [
    earnings[i]?.name || (i === 0 && !earnings.length ? "—" : ""),
    earnings[i] ? formatAmount(earnings[i].amount) : "",
    deductions[i]?.name || (i === 0 && !deductions.length ? "—" : ""),
    deductions[i] ? formatAmount(deductions[i].amount) : "",
  ]);

  y = drawSectionTitle(doc, "Earnings & Deductions", doc.lastAutoTable.finalY + 10);

  autoTable(doc, {
    startY: y,
    head: [["Earnings", "Amount (Rs.)", "Deductions", "Amount (Rs.)"]],
    body: rows,
    foot: [["Gross Earnings", formatAmount(gross), "Total Deductions", formatAmount(totalDed)]],
    ...tableThemeStyles(),
    footStyles: {
      fillColor: PDF_THEME.primarySoft,
      textColor: PDF_THEME.primaryDeep,
      fontStyle: "bold",
    },
    columnStyles: {
      1: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
  });

  const net = gross - totalDed;
  y = doc.lastAutoTable.finalY + 8;

  doc.setFillColor(...PDF_THEME.successBg);
  doc.setDrawColor(...PDF_THEME.primary);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, "FD");
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...PDF_THEME.primaryDeep);
  doc.text("NET PAYABLE", 20, y + 10);
  doc.text(`Rs. ${formatAmount(net)}`, pageWidth - 20, y + 10, { align: "right" });
  doc.setTextColor(...PDF_THEME.text);
  doc.setFont(undefined, "normal");

  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: `Computer-generated salary slip for ${MONTH(data.periodMonth)}. Valid without signature. Issued ${formatPdfDate(new Date())}.`,
  });

  doc.save(
    safeFileName(`payslip-${data.employeeName || "staff"}-${(data.periodMonth || "").slice(0, 7)}`)
  );
  return doc;
}
