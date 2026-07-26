"use client";

import Link from 'next/link';
import { useQuery, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import StatCard from '@/components/StatCard';
import { useTenantPaths } from '@/lib/useTenantPaths';
import { formatInr, formatInrCompact } from '@/lib/currency';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock,
  IndianRupee,
  Loader2,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';

const GET_OVERVIEW = gql`
  query OpsAdminOverview {
    feeCollectionSummary {
      nodes {
        totalBilled
        totalCollected
        totalOutstanding
        totalOverdue
        collectedToday
        collectedThisMonth
        invoiceCount
        defaulterCount
      }
    }
    feeOutstandingByClass {
      nodes {
        classId
        className
        studentCount
        billed
        collected
        outstanding
      }
    }
    payrollSummary {
      nodes {
        staffOnPayroll
        monthlyGross
        monthlyNet
        lastRunMonth
        lastRunStatus
        pendingPayslips
      }
    }
    expenseSummary {
      nodes {
        spentThisMonth
        spentThisYear
        pendingCount
        pendingAmount
        approvedUnpaid
      }
    }
    allFeePayments(orderBy: PAID_ON_DESC, first: 8) {
      nodes {
        id
        amount
        paidOn
        mode
        receiptNumber
        studentByStudentId {
          userByUserId {
            fullName
          }
        }
      }
    }
  }
`;

const MONTH = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—';

const RUN_STYLE = {
  draft: 'bg-zinc-100 text-zinc-600',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function QuickLink({ href, icon: Icon, title, note }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:shadow-md"
    >
      <div className="rounded-xl bg-primary-50 p-3 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-zinc-900">{title}</div>
        <div className="truncate text-xs text-zinc-500">{note}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500" />
    </Link>
  );
}

function OpsAdminContent() {
  const { to } = useTenantPaths();
  const { loading, data, error } = useQuery(GET_OVERVIEW);

  const fees = data?.feeCollectionSummary?.nodes?.[0];
  const payroll = data?.payrollSummary?.nodes?.[0];
  const expenses = data?.expenseSummary?.nodes?.[0];
  const byClass = (data?.feeOutstandingByClass?.nodes || []).filter((c) => Number(c.outstanding) > 0);
  const payments = data?.allFeePayments?.nodes || [];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Could not load the finance overview: {error.message}
      </div>
    );
  }

  const maxOutstanding = Math.max(...byClass.map((c) => Number(c.outstanding)), 1);

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">Operations</h1>
        <p className="text-zinc-500">Fee collection, payroll and spending for the school at a glance.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Collected Today"
          value={formatInr(fees?.collectedToday || 0)}
          subtitle={`${formatInr(fees?.collectedThisMonth || 0)} this month`}
          icon={IndianRupee}
          color="green"
        />
        <StatCard
          title="Outstanding"
          value={formatInrCompact(fees?.totalOutstanding || 0)}
          subtitle={`${fees?.defaulterCount || 0} students with dues`}
          icon={AlertTriangle}
          color="yellow"
        />
        <StatCard
          title="Overdue"
          value={formatInrCompact(fees?.totalOverdue || 0)}
          subtitle={`of ${formatInrCompact(fees?.totalBilled || 0)} billed`}
          icon={Clock}
          color="red"
        />
        <StatCard
          title="Monthly Payroll"
          value={formatInrCompact(payroll?.monthlyNet || 0)}
          subtitle={`${payroll?.staffOnPayroll || 0} staff on payroll`}
          icon={Wallet}
          color="primary"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Outstanding by class</h2>
            <Link href={to('/admin/fees/invoices')} className="text-sm font-medium text-primary-600 hover:underline">
              Collect fees
            </Link>
          </div>
          {byClass.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Every class is fully paid up.</p>
          ) : (
            <div className="space-y-4">
              {byClass.map((c) => (
                <div key={c.classId}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-zinc-800">{c.className}</span>
                    <span className="text-zinc-500">
                      {formatInr(c.collected)} of {formatInr(c.billed)} collected
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${(Number(c.outstanding) / maxOutstanding) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-semibold text-amber-600">
                      {formatInr(c.outstanding)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Payroll</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Last run</dt>
                <dd className="font-medium text-zinc-800">{MONTH(payroll?.lastRunMonth)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Status</dt>
                <dd>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${RUN_STYLE[payroll?.lastRunStatus] || 'bg-zinc-100 text-zinc-600'}`}>
                    {payroll?.lastRunStatus || 'not run'}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Gross</dt>
                <dd className="font-medium text-zinc-800">{formatInr(payroll?.monthlyGross || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Unpaid payslips</dt>
                <dd className="font-medium text-zinc-800">{payroll?.pendingPayslips || 0}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Expenses</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Spent this month</dt>
                <dd className="font-medium text-zinc-800">{formatInr(expenses?.spentThisMonth || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Spent this year</dt>
                <dd className="font-medium text-zinc-800">{formatInr(expenses?.spentThisYear || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Awaiting approval</dt>
                <dd className="font-medium text-amber-600">
                  {formatInr(expenses?.pendingAmount || 0)}{' '}
                  <span className="text-xs text-zinc-500">({expenses?.pendingCount || 0})</span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Approved, unpaid</dt>
                <dd className="font-medium text-zinc-800">{formatInr(expenses?.approvedUnpaid || 0)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Recent payments</h2>
          <Link href={to('/admin/fees/invoices')} className="text-sm font-medium text-primary-600 hover:underline">
            All invoices
          </Link>
        </div>
        {payments.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-500">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3">Receipt</th>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Mode</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-3 font-mono text-xs text-zinc-500">{p.receiptNumber}</td>
                  <td className="px-6 py-3 font-medium text-zinc-800">
                    {p.studentByStudentId?.userByUserId?.fullName || '—'}
                  </td>
                  <td className="px-6 py-3 text-zinc-600">{p.paidOn}</td>
                  <td className="px-6 py-3 uppercase text-zinc-500">{p.mode}</td>
                  <td className="px-6 py-3 text-right font-semibold text-green-600">{formatInr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink href={to('/admin/fees/invoices')} icon={Receipt} title="Collect fees" note="Record a payment, print a receipt" />
        <QuickLink href={to('/admin/fees/plans')} icon={Users} title="Fee plans" note="Class-wise pricing and invoicing" />
        <QuickLink href={to('/admin/payroll')} icon={Wallet} title="Run payroll" note="Generate and approve this month" />
        <QuickLink href={to('/admin/expenses')} icon={Banknote} title="Expenses" note="Record bills and track approvals" />
      </div>
    </div>
  );
}

export default function OpsAdminPage() {
  return (
    <ApolloWrapper>
      <OpsAdminContent />
    </ApolloWrapper>
  );
}
