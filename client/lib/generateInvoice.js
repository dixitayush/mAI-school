import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAmount } from "./currency";
import { safeFileName } from "./pdfUtils";

const BRAND = [79, 70, 229];
const MUTED = [120, 120, 120];

function header(doc, schoolName, title) {
  const pageWidth = doc.internal.pageSize.width;
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(schoolName || "MAI School", 14, 15);
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(title, pageWidth - 14, 15, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return pageWidth;
}

function metaBlock(doc, left, right, startY) {
  autoTable(doc, {
    startY,
    body: left.map((row, i) => [...row, ...(right[i] || ["", ""])]),
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.6 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26, textColor: MUTED },
      1: { cellWidth: 62 },
      2: { fontStyle: "bold", cellWidth: 26, textColor: MUTED },
      3: { cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

function totalsBlock(doc, rows, startY) {
  const pageWidth = doc.internal.pageSize.width;
  autoTable(doc, {
    startY,
    margin: { left: pageWidth / 2 },
    body: rows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45 },
      1: { halign: "right", cellWidth: "auto" },
    },
  });
  return doc.lastAutoTable.finalY;
}

function footerNote(doc, note) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(note, 14, pageHeight - 14, { maxWidth: pageWidth - 28 });
  doc.setTextColor(0, 0, 0);
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
  const pageWidth = header(doc, data.schoolName, "FEE INVOICE");

  let y = metaBlock(
    doc,
    [
      ["Invoice", data.invoiceNumber || "-"],
      ["Student", data.studentName || "-"],
      ["Class", data.className || "-"],
    ],
    [
      ["Issued", data.issueDate ? new Date(data.issueDate).toLocaleDateString("en-IN") : "-"],
      ["Due", data.dueDate ? new Date(data.dueDate).toLocaleDateString("en-IN") : "-"],
      ["Period", data.periodLabel || "-"],
    ],
    44
  );

  const lines = data.lines || [];
  const subtotal = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const discount = lines.reduce((s, l) => s + Number(l.discount || 0), 0);
  const paid = lines.reduce((s, l) => s + Number(l.paid || 0), 0);
  const total = subtotal - discount;

  autoTable(doc, {
    startY: y + 6,
    head: [["#", "Fee Head", "Description", "Amount (Rs.)", "Discount (Rs.)", "Payable (Rs.)"]],
    body: lines.map((l, i) => [
      i + 1,
      l.head || "-",
      l.description || "-",
      formatAmount(l.amount),
      formatAmount(l.discount),
      formatAmount(Number(l.amount || 0) - Number(l.discount || 0)),
    ]),
    theme: "grid",
    headStyles: { fillColor: BRAND, fontSize: 9.5, fontStyle: "bold" },
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
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

  doc.setDrawColor(220, 220, 220);
  doc.line(pageWidth - 75, y + 24, pageWidth - 14, y + 24);
  doc.setFontSize(9);
  doc.text("Authorised Signatory", pageWidth - 75, y + 29);

  footerNote(
    doc,
    "This is a computer-generated invoice. Please quote the invoice number when making payment."
  );

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
  const pageWidth = header(doc, data.schoolName, "FEE RECEIPT");

  let y = metaBlock(
    doc,
    [
      ["Receipt", data.receiptNumber || "-"],
      ["Student", data.studentName || "-"],
      ["Class", data.className || "-"],
    ],
    [
      ["Date", data.paidOn ? new Date(data.paidOn).toLocaleDateString("en-IN") : "-"],
      ["Invoice", data.invoiceNumber || "-"],
      ["Received By", data.collectedBy || "-"],
    ],
    44
  );

  const payments = data.payments || [];
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  autoTable(doc, {
    startY: y + 6,
    head: [["#", "Fee Head", "Mode", "Reference", "Amount (Rs.)"]],
    body: payments.map((p, i) => [
      i + 1,
      p.head || p.description || "-",
      (p.mode || "-").toUpperCase(),
      p.reference || "-",
      formatAmount(p.amount),
    ]),
    theme: "grid",
    headStyles: { fillColor: BRAND, fontSize: 9.5, fontStyle: "bold" },
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 10, halign: "center" }, 4: { halign: "right" } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
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

  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text(`Received with thanks: Rs. ${formatAmount(total)}`, 14, y + 14);
  doc.setFont(undefined, "normal");

  doc.setDrawColor(220, 220, 220);
  doc.line(pageWidth - 75, y + 28, pageWidth - 14, y + 28);
  doc.setFontSize(9);
  doc.text("Authorised Signatory", pageWidth - 75, y + 33);

  footerNote(doc, "This is a computer-generated receipt and is valid without a physical signature.");

  doc.save(safeFileName(`receipt-${data.receiptNumber || data.studentName || "payment"}`));
  return doc;
}
