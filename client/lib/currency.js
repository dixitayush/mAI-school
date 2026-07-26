const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_PRECISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toNumber(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Rupees with no paise — for totals, KPIs and charts. */
export function formatInr(value) {
  return INR.format(toNumber(value));
}

/** Rupees with paise — for invoice lines, payments and payslips. */
export function formatInrPrecise(value) {
  return INR_PRECISE.format(toNumber(value));
}

/** Compact rupees for dashboard tiles: 12.5L, 3.4Cr, 45.0k. */
export function formatInrCompact(value) {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Plain grouped number without the symbol — for PDF cells with a ₹ column header. */
export function formatAmount(value) {
  return toNumber(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
