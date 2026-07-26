import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAmount } from "./currency";
import { safeFileName } from "./pdfUtils";

const BRAND = [79, 70, 229];
const MUTED = [120, 120, 120];

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
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(data.schoolName || "MAI School", 14, 14);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Salary Slip — ${MONTH(data.periodMonth)}`, pageWidth - 14, 14, { align: "right" });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 42,
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
    ],
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 30, textColor: MUTED },
      1: { cellWidth: 58 },
      2: { fontStyle: "bold", cellWidth: 30, textColor: MUTED },
      3: { cellWidth: "auto" },
    },
  });

  const components = asArray(data.components);
  const earnings = components.filter((c) => c.type === "earning");
  const deductions = components.filter((c) => c.type === "deduction");
  const gross = earnings.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalDed = deductions.reduce((s, c) => s + Number(c.amount || 0), 0);

  // Pad the shorter column so earnings and deductions line up side by side.
  const rowCount = Math.max(earnings.length, deductions.length);
  const rows = Array.from({ length: rowCount }, (_, i) => [
    earnings[i]?.name || "",
    earnings[i] ? formatAmount(earnings[i].amount) : "",
    deductions[i]?.name || "",
    deductions[i] ? formatAmount(deductions[i].amount) : "",
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [["Earnings", "Amount (Rs.)", "Deductions", "Amount (Rs.)"]],
    body: rows,
    foot: [["Gross Earnings", formatAmount(gross), "Total Deductions", formatAmount(totalDed)]],
    theme: "grid",
    headStyles: { fillColor: BRAND, fontSize: 9.5, fontStyle: "bold" },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: "bold" },
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: {
      1: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
  });

  const net = gross - totalDed;
  let y = doc.lastAutoTable.finalY + 8;

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, "FD");
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.setTextColor(21, 128, 61);
  doc.text("NET PAYABLE", 20, y + 10);
  doc.text(`Rs. ${formatAmount(net)}`, pageWidth - 20, y + 10, { align: "right" });
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, "normal");

  y += 26;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    "This is a computer-generated salary slip and does not require a signature.",
    14,
    y,
    { maxWidth: pageWidth - 28 }
  );

  doc.save(
    safeFileName(`payslip-${data.employeeName || "staff"}-${(data.periodMonth || "").slice(0, 7)}`)
  );
  return doc;
}
