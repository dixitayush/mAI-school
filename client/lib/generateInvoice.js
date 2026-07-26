import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAmount } from "./currency";
import {
  PDF_THEME,
  drawDocumentFooters,
  drawDocumentHeader,
  drawMetaBlock,
  drawSectionTitle,
  formatPdfDate,
  resolveSchoolBrand,
  safeFileName,
  tableThemeStyles,
} from "./pdfUtils";

function totalsBlock(doc, rows, startY) {
  const pageWidth = doc.internal.pageSize.width;
  autoTable(doc, {
    startY,
    margin: { left: pageWidth / 2 },
    body: rows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2, textColor: PDF_THEME.text },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: PDF_THEME.muted },
      1: { halign: "right", cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

function signatory(doc, y) {
  const pageWidth = doc.internal.pageSize.width;
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.4);
  doc.line(pageWidth - 75, y + 24, pageWidth - 14, y + 24);
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text("Authorised Signatory", pageWidth - 75, y + 29);
  doc.setTextColor(...PDF_THEME.text);
}

/**
 * Fee invoice PDF.
 * @param {Object} data
 * @param {string} data.schoolName
 * @param {string} data.invoiceNumber
 * @param {string} data.studentName
 * @param {string} [data.className]
 * @param {string} [data.rollNumber]
 * @param {string} [data.periodLabel]
 * @param {string} data.issueDate
 * @param {string} data.dueDate
 * @param {Array<{head:string, description:string, amount:number, discount:number, paid:number}>} data.lines
 */
export function generateFeeInvoice(data) {
  const doc = new jsPDF();
  const brand = resolveSchoolBrand(data);
  const pageWidth = doc.internal.pageSize.width;

  let y = drawDocumentHeader(doc, {
    title: "FEE INVOICE",
    subtitle: data.invoiceNumber || "",
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "Billing Details", y);

  y = drawMetaBlock(
    doc,
    [
      ["Invoice", data.invoiceNumber || "-"],
      ["Student", data.studentName || "-"],
      ["Class", data.className || "-"],
      ["Roll No.", data.rollNumber || "-"],
    ],
    [
      ["Issued", formatPdfDate(data.issueDate)],
      ["Due", formatPdfDate(data.dueDate)],
      ["Period", data.periodLabel || "-"],
      ["School", brand.name],
    ],
    y,
    autoTable
  );

  const lines = data.lines || [];
  const subtotal = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const discount = lines.reduce((s, l) => s + Number(l.discount || 0), 0);
  const paid = lines.reduce((s, l) => s + Number(l.paid || 0), 0);
  const total = subtotal - discount;

  y = drawSectionTitle(doc, "Charges", y + 10);

  autoTable(doc, {
    startY: y,
    head: [["#", "Fee Head", "Description", "Amount (Rs.)", "Discount (Rs.)", "Payable (Rs.)"]],
    body: lines.map((l, i) => [
      i + 1,
      l.head || "-",
      l.description || "-",
      formatAmount(l.amount),
      formatAmount(l.discount),
      formatAmount(Number(l.amount || 0) - Number(l.discount || 0)),
    ]),
    ...tableThemeStyles(),
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  y = totalsBlock(
    doc,
    [
      ["Subtotal", formatAmount(subtotal)],
      ["Discount", `- ${formatAmount(discount)}`],
      ["Total Payable", formatAmount(total)],
      ["Paid", formatAmount(paid)],
      ["Balance Due", formatAmount(total - paid)],
    ],
    doc.lastAutoTable.finalY + 6
  );

  // Highlight balance
  doc.setFillColor(...PDF_THEME.primarySoft);
  doc.roundedRect(pageWidth / 2, y + 4, pageWidth / 2 - 14, 12, 1.5, 1.5, "F");
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_THEME.primaryDeep);
  doc.text("Balance Due", pageWidth / 2 + 4, y + 12);
  doc.text(`Rs. ${formatAmount(total - paid)}`, pageWidth - 18, y + 12, { align: "right" });
  doc.setFont(undefined, "normal");
  doc.setTextColor(...PDF_THEME.text);

  signatory(doc, y + 10);

  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: "Computer-generated invoice. Quote the invoice number when making payment.",
  });

  doc.save(safeFileName(`invoice-${data.invoiceNumber || data.studentName || "fee"}`));
  return doc;
}

/**
 * Payment receipt PDF. One receipt may settle several invoice lines.
 * @param {Object} data
 * @param {Array<{head:string, description:string, amount:number, mode:string, reference:string}>} data.payments
 */
export function generateFeeReceipt(data) {
  const doc = new jsPDF();
  const brand = resolveSchoolBrand(data);
  const pageWidth = doc.internal.pageSize.width;

  let y = drawDocumentHeader(doc, {
    title: "FEE RECEIPT",
    subtitle: data.receiptNumber || "",
    schoolName: brand.name,
    schoolSlug: brand.slug,
  });

  y = drawSectionTitle(doc, "Receipt Details", y);

  y = drawMetaBlock(
    doc,
    [
      ["Receipt", data.receiptNumber || "-"],
      ["Student", data.studentName || "-"],
      ["Class", data.className || "-"],
    ],
    [
      ["Date", formatPdfDate(data.paidOn)],
      ["Invoice", data.invoiceNumber || "-"],
      ["Received By", data.collectedBy || "-"],
    ],
    y,
    autoTable
  );

  const payments = data.payments || [];
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  y = drawSectionTitle(doc, "Payments Received", y + 10);

  autoTable(doc, {
    startY: y,
    head: [["#", "Fee Head", "Mode", "Reference", "Amount (Rs.)"]],
    body: payments.map((p, i) => [
      i + 1,
      p.head || p.description || "-",
      (p.mode || "-").toUpperCase(),
      p.reference || "-",
      formatAmount(p.amount),
    ]),
    ...tableThemeStyles(),
    columnStyles: { 0: { cellWidth: 10, halign: "center" }, 4: { halign: "right" } },
  });

  y = totalsBlock(
    doc,
    [
      ["Amount Received", formatAmount(total)],
      ...(data.balanceAfter !== undefined
        ? [["Balance Remaining", formatAmount(data.balanceAfter)]]
        : []),
    ],
    doc.lastAutoTable.finalY + 6
  );

  doc.setFillColor(...PDF_THEME.successBg);
  doc.setDrawColor(...PDF_THEME.successBorder);
  doc.roundedRect(14, y + 6, pageWidth - 28, 14, 2, 2, "FD");
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...PDF_THEME.successText);
  doc.text(`Received with thanks: Rs. ${formatAmount(total)}`, 20, y + 15);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...PDF_THEME.text);

  signatory(doc, y + 14);

  drawDocumentFooters(doc, {
    schoolName: brand.name,
    schoolSlug: brand.slug,
    note: "Computer-generated receipt — valid without a physical signature.",
  });

  doc.save(safeFileName(`receipt-${data.receiptNumber || data.studentName || "payment"}`));
  return doc;
}
