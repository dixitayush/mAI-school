"use client";

import { useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import StatCard from '@/components/StatCard';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Download, Receipt, IndianRupee, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { formatInr, formatInrPrecise } from '@/lib/currency';
import { generateFeeInvoice, generateFeeReceipt } from '@/lib/generateInvoice';

// RLS restricts these to the signed-in student's own rows.
const GET_MY_FEES = gql`
  query GetMyFees {
    allFeeInvoices(orderBy: ISSUE_DATE_DESC) {
      nodes {
        id
        invoiceNumber
        periodLabel
        issueDate
        dueDate
        total
        paidTotal
        status
        studentByStudentId {
          rollNumber
          userByUserId { fullName }
          classByClassId { name }
        }
        feesByInvoiceId {
          nodes {
            id
            description
            amount
            discountAmount
            paidAmount
            balance
            status
            feeHeadByFeeHeadId { name code }
          }
        }
        feePaymentsByInvoiceId {
          nodes {
            id
            receiptNumber
            amount
            paidOn
            mode
            referenceNo
            feeId
          }
        }
      }
    }
    allFees {
      nodes {
        id
        amount
        discountAmount
        paidAmount
        balance
        status
        dueDate
      }
    }
  }
`;

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-blue-100 text-blue-700',
  issued: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const schoolName = () => {
  try {
    return JSON.parse(localStorage.getItem('institution') || 'null')?.name;
  } catch {
    return undefined;
  }
};

function MyFeesContent() {
  const { loading, data } = useQuery(GET_MY_FEES);

  const invoices = useMemo(() => data?.allFeeInvoices?.nodes || [], [data]);
  const fees = useMemo(() => data?.allFees?.nodes || [], [data]);

  const totals = useMemo(() => {
    const num = (v) => parseFloat(v || 0);
    const active = fees.filter((f) => f.status !== 'cancelled');
    return {
      billed: active.reduce((s, f) => s + num(f.amount) - num(f.discountAmount), 0),
      paid: active.reduce((s, f) => s + num(f.paidAmount), 0),
      due: active
        .filter((f) => !['paid', 'waived'].includes(f.status))
        .reduce((s, f) => s + num(f.balance), 0),
      overdue: active
        .filter((f) => f.status === 'overdue')
        .reduce((s, f) => s + num(f.balance), 0),
    };
  }, [fees]);

  const download = (inv) => {
    try {
      generateFeeInvoice({
        schoolName: schoolName(),
        invoiceNumber: inv.invoiceNumber,
        studentName: inv.studentByStudentId?.userByUserId?.fullName,
        className: inv.studentByStudentId?.classByClassId?.name,
        rollNumber: inv.studentByStudentId?.rollNumber,
        periodLabel: inv.periodLabel,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        lines: (inv.feesByInvoiceId?.nodes || []).map((l) => ({
          head: l.feeHeadByFeeHeadId?.name || '-',
          description: l.description,
          amount: l.amount,
          discount: l.discountAmount,
          paid: l.paidAmount,
        })),
      });
    } catch (err) {
      toast.error('Could not build the invoice PDF: ' + err.message);
    }
  };

  const downloadReceipt = (inv, receiptNumber) => {
    const payments = (inv.feePaymentsByInvoiceId?.nodes || []).filter((p) => p.receiptNumber === receiptNumber);
    const lineFor = (feeId) => (inv.feesByInvoiceId?.nodes || []).find((l) => l.id === feeId);
    try {
      generateFeeReceipt({
        schoolName: schoolName(),
        receiptNumber,
        invoiceNumber: inv.invoiceNumber,
        studentName: inv.studentByStudentId?.userByUserId?.fullName,
        className: inv.studentByStudentId?.classByClassId?.name,
        paidOn: payments[0]?.paidOn,
        balanceAfter: parseFloat(inv.total) - parseFloat(inv.paidTotal),
        payments: payments.map((p) => ({
          head: lineFor(p.feeId)?.feeHeadByFeeHeadId?.name || 'Fee',
          mode: p.mode,
          reference: p.referenceNo,
          amount: p.amount,
        })),
      });
    } catch (err) {
      toast.error('Could not build the receipt PDF: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">My Fees</h1>
        <p className="text-zinc-500">Your invoices, payments and outstanding balance.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Billed" value={formatInr(totals.billed)} icon={FileText} color="primary" />
        <StatCard title="Paid" value={formatInr(totals.paid)} icon={CheckCircle2} color="green" />
        <StatCard title="Balance Due" value={formatInr(totals.due)} icon={IndianRupee} color="yellow" />
        <StatCard title="Overdue" value={formatInr(totals.overdue)} icon={AlertTriangle} color="red" />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">
          Loading your fee records...
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No invoices yet</p>
          <p className="mt-1 text-sm text-zinc-500">Your fee invoices will appear here once the school raises them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv, i) => {
            const balance = parseFloat(inv.total) - parseFloat(inv.paidTotal);
            const receipts = [...new Set((inv.feePaymentsByInvoiceId?.nodes || []).map((p) => p.receiptNumber))];
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <div className="flex flex-col gap-3 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900">{inv.invoiceNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[inv.status] || 'bg-zinc-100 text-zinc-700'}`}>
                        {inv.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {inv.periodLabel ? `${inv.periodLabel} · ` : ''}
                      Due {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-zinc-400">Balance</p>
                      <p className={`text-lg font-bold ${balance > 0 ? 'text-zinc-900' : 'text-green-600'}`}>
                        {formatInrPrecise(balance)}
                      </p>
                    </div>
                    <button
                      onClick={() => download(inv)}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      <Download className="h-3.5 w-3.5" /> Invoice
                    </button>
                    {receipts.map((r) => (
                      <button
                        key={r}
                        onClick={() => downloadReceipt(inv, r)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Receipt className="h-3.5 w-3.5" /> {r}
                      </button>
                    ))}
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-zinc-50/50">
                    <tr>
                      <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-zinc-500">Fee Head</th>
                      <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-zinc-500">Amount</th>
                      <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-zinc-500">Discount</th>
                      <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-zinc-500">Paid</th>
                      <th className="px-5 py-2 text-right text-xs font-semibold uppercase text-zinc-500">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(inv.feesByInvoiceId?.nodes || []).map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-2.5 text-zinc-800">{l.feeHeadByFeeHeadId?.name || l.description}</td>
                        <td className="px-5 py-2.5 text-right text-zinc-600">{formatInrPrecise(l.amount)}</td>
                        <td className="px-5 py-2.5 text-right text-zinc-600">{formatInrPrecise(l.discountAmount)}</td>
                        <td className="px-5 py-2.5 text-right text-green-700">{formatInrPrecise(l.paidAmount)}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-zinc-900">{formatInrPrecise(l.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyFeesPage() {
  return (
    <ApolloWrapper>
      <MyFeesContent />
    </ApolloWrapper>
  );
}
