"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { CreditCard, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-800",
  trial: "bg-blue-100 text-blue-800",
  suspended: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
};

export default function BillingPage() {
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/billing"),
      apiFetch("/api/billing/invoices"),
    ])
      .then(([b, inv]) => {
        setBilling(b.billing || b);
        setInvoices(inv.invoices || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <CreditCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Billing</h1>
          <p className="text-sm text-zinc-500">Subscription and invoice management.</p>
        </div>
      </div>

      {billing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Plan</p>
            <p className="mt-1 text-xl font-bold capitalize text-zinc-900">{billing.plan || "—"}</p>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[billing.status] || "bg-zinc-100 text-zinc-700"}`}>
              {billing.status || "unknown"}
            </span>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Active students</p>
            <p className="mt-1 text-xl font-bold text-zinc-900">{billing.active_student_count ?? "—"}</p>
            <p className="mt-1 text-xs text-zinc-500">Rate: {formatCurrency(billing.per_student_rate)}/student/mo</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Billing period</p>
            <p className="mt-1 text-sm font-medium text-zinc-800">
              {billing.billing_start ? new Date(billing.billing_start).toLocaleDateString() : "—"} — {billing.billing_end ? new Date(billing.billing_end).toLocaleDateString() : "—"}
            </p>
            {billing.trial_ends_at && (
              <p className="mt-1 text-xs text-blue-600">Trial ends: {new Date(billing.trial_ends_at).toLocaleDateString()}</p>
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Invoices</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">No invoices yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-zinc-800">{inv.invoice_number || inv.id.slice(0, 8)}</td>
                    <td className="px-5 py-3 text-zinc-500">
                      {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : "—"} — {inv.period_end ? new Date(inv.period_end).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900">{formatCurrency(inv.amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[inv.status] || "bg-zinc-100 text-zinc-700"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
