"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import { toast } from 'react-hot-toast';
import { Download, IndianRupee, Search, Receipt, FileText, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatInr, formatInrPrecise } from '@/lib/currency';
import { generateFeeInvoice, generateFeeReceipt } from '@/lib/generateInvoice';

const GET_INVOICES = gql`
  query GetInvoices {
    allFeeInvoices(orderBy: ISSUE_DATE_DESC) {
      nodes {
        id
        invoiceNumber
        periodLabel
        issueDate
        dueDate
        subtotal
        discountTotal
        total
        paidTotal
        status
        studentByStudentId {
          id
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
    feeCollectionSummary {
      nodes {
        totalBilled
        totalCollected
        totalOutstanding
        totalOverdue
        collectedToday
        collectedThisMonth
      }
    }
  }
`;

const RECORD_PAYMENT = gql`
  mutation RecordPayment(
    $feeId: UUID!
    $amount: BigFloat!
    $mode: String
    $paidOn: Date
    $referenceNo: String
    $receiptNumber: String
  ) {
    recordFeePayment(
      input: {
        pFeeId: $feeId
        pAmount: $amount
        pMode: $mode
        pPaidOn: $paidOn
        pReferenceNo: $referenceNo
        pReceiptNumber: $receiptNumber
      }
    ) {
      results {
        receiptNumber
        feeStatus
        feeBalance
      }
    }
  }
`;

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-blue-100 text-blue-700',
  issued: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-zinc-100 text-zinc-600',
  cancelled: 'bg-red-100 text-red-700',
};

const MODES = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['card', 'Card'],
  ['netbanking', 'Net Banking'],
  ['cheque', 'Cheque'],
  ['dd', 'Demand Draft'],
  ['other', 'Other'],
];

const FIELD =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

const schoolName = () => {
  try {
    return JSON.parse(localStorage.getItem('institution') || 'null')?.name;
  } catch {
    return undefined;
  }
};

/** Collect against every unpaid line of an invoice, under a single receipt. */
function CollectModal({ isOpen, onClose, invoice, onCollect }) {
  const [rows, setRows] = useState({});
  const [meta, setMeta] = useState({ mode: 'cash', paidOn: '', referenceNo: '' });
  const [saving, setSaving] = useState(false);

  const lines = useMemo(
    () => (invoice?.feesByInvoiceId?.nodes || []).filter((l) => parseFloat(l.balance) > 0),
    [invoice]
  );

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setRows(Object.fromEntries(lines.map((l) => [l.id, l.balance])));
    setMeta({ mode: 'cash', paidOn: new Date().toISOString().slice(0, 10), referenceNo: '' });
  }, [isOpen, invoice, lines]);

  const totalEntered = Object.values(rows).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    const payable = lines
      .map((l) => ({ feeId: l.id, amount: parseFloat(rows[l.id]) || 0, max: parseFloat(l.balance) }))
      .filter((r) => r.amount > 0);

    if (payable.length === 0) return toast.error('Enter an amount to collect');
    const over = payable.find((r) => r.amount > r.max);
    if (over) return toast.error('One of the amounts exceeds the outstanding balance');

    setSaving(true);
    try {
      await onCollect(payable, meta);
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Payment" maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-zinc-50 p-3 text-sm">
          <span className="font-semibold text-zinc-900">
            {invoice.studentByStudentId?.userByUserId?.fullName}
          </span>
          <span className="text-zinc-500">
            {' '}· {invoice.studentByStudentId?.classByClassId?.name || '-'} · {invoice.invoiceNumber}
          </span>
        </div>

        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">This invoice is fully settled.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-zinc-500">Fee Head</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-zinc-500">Balance</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-zinc-500">Collect (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-zinc-800">{l.feeHeadByFeeHeadId?.name || l.description}</td>
                    <td className="px-4 py-2 text-right text-zinc-600">{formatInrPrecise(l.balance)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={l.balance}
                        step="0.01"
                        value={rows[l.id] ?? ''}
                        onChange={(e) => setRows((r) => ({ ...r, [l.id]: e.target.value }))}
                        className="w-32 rounded-lg border border-zinc-300 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Mode</label>
            <select
              value={meta.mode}
              onChange={(e) => setMeta((m) => ({ ...m, mode: e.target.value }))}
              className={`${FIELD} bg-white`}
            >
              {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Paid on</label>
            <input
              type="date"
              value={meta.paidOn}
              onChange={(e) => setMeta((m) => ({ ...m, paidOn: e.target.value }))}
              className={FIELD}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Reference no.</label>
            <input
              value={meta.referenceNo}
              onChange={(e) => setMeta((m) => ({ ...m, referenceNo: e.target.value }))}
              className={FIELD}
              placeholder="UTR / cheque no."
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
          <span className="text-sm font-medium text-primary-900">Total to collect</span>
          <span className="text-lg font-bold text-primary-900">{formatInrPrecise(totalEntered)}</span>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || lines.length === 0}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Recording...' : 'Record Payment & Print Receipt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InvoicesContent() {
  const { loading, data, refetch } = useQuery(GET_INVOICES);
  const [recordPayment] = useMutation(RECORD_PAYMENT);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collecting, setCollecting] = useState(null);

  const invoices = useMemo(() => data?.allFeeInvoices?.nodes || [], [data]);
  const summary = data?.feeCollectionSummary?.nodes?.[0];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!q) return true;
      const name = inv.studentByStudentId?.userByUserId?.fullName?.toLowerCase() || '';
      return name.includes(q) || (inv.invoiceNumber || '').toLowerCase().includes(q);
    });
  }, [invoices, search, statusFilter]);

  const downloadInvoice = (inv) => {
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
    const payments = (inv.feePaymentsByInvoiceId?.nodes || []).filter(
      (p) => p.receiptNumber === receiptNumber
    );
    if (payments.length === 0) return toast.error('No payments found for that receipt');
    const lineFor = (feeId) => (inv.feesByInvoiceId?.nodes || []).find((l) => l.id === feeId);
    try {
      generateFeeReceipt({
        schoolName: schoolName(),
        receiptNumber,
        invoiceNumber: inv.invoiceNumber,
        studentName: inv.studentByStudentId?.userByUserId?.fullName,
        className: inv.studentByStudentId?.classByClassId?.name,
        paidOn: payments[0].paidOn,
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

  const handleCollect = async (payable, meta) => {
    try {
      // The first call mints the receipt number; the rest join the same receipt.
      let receipt = null;
      for (const row of payable) {
        const res = await recordPayment({
          variables: {
            feeId: row.feeId,
            amount: String(row.amount),
            mode: meta.mode,
            paidOn: meta.paidOn || null,
            referenceNo: meta.referenceNo || null,
            receiptNumber: receipt,
          },
        });
        receipt = res.data?.recordFeePayment?.results?.[0]?.receiptNumber || receipt;
      }
      toast.success(`Payment recorded — receipt ${receipt}`);
      const { data: fresh } = await refetch();
      const updated = fresh?.allFeeInvoices?.nodes?.find((i) => i.id === collecting.id);
      if (updated && receipt) downloadReceipt(updated, receipt);
      setCollecting(null);
    } catch (err) {
      toast.error('Payment failed: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">Invoices &amp; Collection</h1>
        <p className="text-zinc-500">Collect fees, print receipts and track outstanding dues.</p>
      </div>

      {summary && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Billed" value={formatInr(summary.totalBilled)} icon={Wallet} color="primary" />
          <StatCard title="Collected" value={formatInr(summary.totalCollected)} icon={CheckCircle2} color="green" />
          <StatCard title="Outstanding" value={formatInr(summary.totalOutstanding)} icon={IndianRupee} color="yellow" />
          <StatCard title="Collected This Month" value={formatInr(summary.collectedThisMonth)} icon={AlertTriangle} color="blue" />
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or invoice no."
              className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All statuses</option>
            <option value="issued">Issued</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50/50">
              <tr>
                {['Invoice', 'Student', 'Class', 'Period', 'Due', 'Total', 'Paid', 'Balance', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-400">Loading invoices...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    <p className="text-sm text-zinc-500">
                      No invoices yet. Generate them from a fee plan.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const balance = parseFloat(inv.total) - parseFloat(inv.paidTotal);
                  const receipts = [...new Set((inv.feePaymentsByInvoiceId?.nodes || []).map((p) => p.receiptNumber))];
                  return (
                    <tr key={inv.id} className="hover:bg-zinc-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900">{inv.invoiceNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                        {inv.studentByStudentId?.userByUserId?.fullName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
                        {inv.studentByStudentId?.classByClassId?.name || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">{inv.periodLabel || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
                        {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900">{formatInrPrecise(inv.total)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-green-700">{formatInrPrecise(inv.paidTotal)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-900">{formatInrPrecise(balance)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_STYLES[inv.status] || 'bg-zinc-100 text-zinc-700'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1">
                          {balance > 0 && (
                            <button
                              onClick={() => setCollecting(inv)}
                              className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                            >
                              <IndianRupee className="h-3 w-3" /> Collect
                            </button>
                          )}
                          <button
                            onClick={() => downloadInvoice(inv)}
                            title="Download invoice"
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-primary-600"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {receipts.map((r) => (
                            <button
                              key={r}
                              onClick={() => downloadReceipt(inv, r)}
                              title={`Receipt ${r}`}
                              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-primary-600"
                            >
                              <Receipt className="h-4 w-4" />
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CollectModal
        isOpen={Boolean(collecting)}
        onClose={() => setCollecting(null)}
        invoice={collecting}
        onCollect={handleCollect}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <ApolloWrapper>
      <InvoicesContent />
    </ApolloWrapper>
  );
}
