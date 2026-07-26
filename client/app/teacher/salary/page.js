"use client";

import { useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import StatCard from '@/components/StatCard';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Download, Wallet, Landmark, TrendingUp, Receipt } from 'lucide-react';
import { formatInr, formatInrPrecise } from '@/lib/currency';
import { generatePayslip } from '@/lib/generatePayslip';

// RLS limits every one of these to the signed-in staff member's own rows.
const GET_MY_SALARY = gql`
  query GetMySalary {
    allPayslips(orderBy: PERIOD_MONTH_DESC) {
      nodes {
        id
        periodMonth
        workingDays
        paidDays
        lopDays
        grossEarnings
        totalDeductions
        netPay
        components
        paymentStatus
        paidOn
        userByUserId { fullName role }
      }
    }
    allSalaryStructures {
      nodes {
        id
        name
        effectiveFrom
        effectiveTo
        annualCtc
        basicMonthly
        paymentMode
        isActive
        salaryComponentsBySalaryStructureId {
          nodes { id name code componentType calculation value sortOrder }
        }
      }
    }
    allStaffBankAccounts {
      nodes {
        id
        accountHolderName
        accountNumber
        ifscCode
        bankName
        branchName
        upiId
        panNumber
        pfNumber
      }
    }
  }
`;

const monthLabel = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '-';

const maskAccount = (n) => (n && n.length > 4 ? `${'•'.repeat(n.length - 4)}${n.slice(-4)}` : n || '-');

const schoolName = () => {
  try {
    return JSON.parse(localStorage.getItem('institution') || 'null')?.name;
  } catch {
    return undefined;
  }
};

function MySalaryContent() {
  const { loading, data } = useQuery(GET_MY_SALARY);

  const payslips = useMemo(() => data?.allPayslips?.nodes || [], [data]);
  const structure = useMemo(
    () => (data?.allSalaryStructures?.nodes || []).find((s) => s.isActive) || null,
    [data]
  );
  const bank = data?.allStaffBankAccounts?.nodes?.[0] || null;

  const ytd = useMemo(() => {
    const year = new Date().getFullYear();
    const rows = payslips.filter((p) => new Date(p.periodMonth).getFullYear() === year);
    return {
      gross: rows.reduce((s, p) => s + parseFloat(p.grossEarnings || 0), 0),
      net: rows.reduce((s, p) => s + parseFloat(p.netPay || 0), 0),
      deductions: rows.reduce((s, p) => s + parseFloat(p.totalDeductions || 0), 0),
    };
  }, [payslips]);

  const download = (slip) => {
    try {
      generatePayslip({
        schoolName: schoolName(),
        employeeName: slip.userByUserId?.fullName,
        designation: slip.userByUserId?.role,
        periodMonth: slip.periodMonth,
        workingDays: slip.workingDays,
        paidDays: slip.paidDays,
        lopDays: slip.lopDays,
        paymentMode: structure?.paymentMode,
        accountNumber: bank?.accountNumber,
        ifscCode: bank?.ifscCode,
        panNumber: bank?.panNumber,
        pfNumber: bank?.pfNumber,
        components: slip.components || [],
      });
    } catch (err) {
      toast.error('Could not build the payslip: ' + err.message);
    }
  };

  const latest = payslips[0];

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">My Salary</h1>
        <p className="text-zinc-500">Your compensation structure, payslips and bank details.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Annual CTC" value={structure ? formatInr(structure.annualCtc) : '—'} icon={TrendingUp} color="primary" />
        <StatCard title="Last Net Pay" value={latest ? formatInr(latest.netPay) : '—'} icon={Wallet} color="green" />
        <StatCard title="Earned This Year" value={formatInr(ytd.net)} icon={Receipt} color="blue" />
        <StatCard title="Deducted This Year" value={formatInr(ytd.deductions)} icon={Landmark} color="yellow" />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">Loading your salary details...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 p-6">
              <h2 className="text-lg font-bold text-zinc-900">Payslips</h2>
              <p className="text-sm text-zinc-500">Download any month&apos;s salary slip.</p>
            </div>
            {payslips.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
                <p className="font-medium text-zinc-900">No payslips yet</p>
                <p className="mt-1 text-sm text-zinc-500">They will appear here once payroll is run.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {payslips.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{monthLabel(p.periodMonth)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${p.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {p.paymentStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {p.paidDays} of {p.workingDays} days paid
                        {parseFloat(p.lopDays) > 0 ? ` · ${p.lopDays} LOP` : ''}
                        {p.paidOn ? ` · credited ${new Date(p.paidOn).toLocaleDateString('en-IN')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-zinc-400">Net pay</p>
                        <p className="text-lg font-bold text-green-700">{formatInrPrecise(p.netPay)}</p>
                      </div>
                      <button
                        onClick={() => download(p)}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Download className="h-3.5 w-3.5" /> Payslip
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {structure && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-500">Salary Structure</h3>
                <p className="text-sm font-medium text-zinc-900">{structure.name || 'Standard structure'}</p>
                <p className="mb-4 text-xs text-zinc-500">
                  Effective {new Date(structure.effectiveFrom).toLocaleDateString('en-IN')}
                  {structure.effectiveTo ? ` – ${new Date(structure.effectiveTo).toLocaleDateString('en-IN')}` : ' onwards'}
                </p>
                <div className="space-y-2">
                  {[...(structure.salaryComponentsBySalaryStructureId?.nodes || [])]
                    .sort((a, b) => (a.componentType === b.componentType ? a.sortOrder - b.sortOrder : a.componentType === 'earning' ? -1 : 1))
                    .map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span className={c.componentType === 'earning' ? 'text-zinc-700' : 'text-red-600'}>
                          {c.name}
                        </span>
                        <span className="font-medium text-zinc-900">
                          {c.calculation === 'fixed' ? formatInrPrecise(c.value) : `${c.value}%`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                <Landmark className="h-4 w-4" /> Bank Details
              </h3>
              {bank ? (
                <dl className="space-y-3 text-sm">
                  {[
                    ['Account holder', bank.accountHolderName],
                    ['Account number', maskAccount(bank.accountNumber)],
                    ['IFSC', bank.ifscCode],
                    ['Bank', bank.bankName || '-'],
                    ['UPI', bank.upiId || '-'],
                    ['PAN', bank.panNumber || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-right font-medium text-zinc-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-zinc-500">
                  No bank details on record. Ask the office to add them so your salary can be credited.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MySalaryPage() {
  return (
    <ApolloWrapper>
      <MySalaryContent />
    </ApolloWrapper>
  );
}
