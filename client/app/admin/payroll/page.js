"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Play, CheckCircle2, Wallet, Download, Users, CalendarDays, BadgeCheck } from 'lucide-react';
import { getInstitutionIdFromStorage } from '@/lib/tenant';
import { formatInr, formatInrPrecise } from '@/lib/currency';
import { generatePayslip } from '@/lib/generatePayslip';

const GET_PAYROLL = gql`
  query GetPayroll {
    allPayrollRuns(orderBy: PERIOD_MONTH_DESC) {
      nodes {
        id
        periodMonth
        status
        workingDays
        totalGross
        totalDeductions
        totalNet
        staffCount
        approvedAt
        paidAt
        payslipsByPayrollRunId {
          nodes {
            id
            userId
            workingDays
            paidDays
            lopDays
            grossEarnings
            totalDeductions
            netPay
            components
            paymentStatus
            userByUserId { id fullName role }
          }
        }
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
    allStaffBankAccounts {
      nodes { userId accountNumber ifscCode panNumber pfNumber }
    }
    allStaffAttendances {
      nodes { id userId periodMonth workingDays unpaidLeaveDays }
    }
  }
`;

const GENERATE = gql`
  mutation GeneratePayroll($institutionId: UUID!, $month: Date!) {
    generatePayroll(input: { pInstitutionId: $institutionId, pPeriodMonth: $month }) {
      results { payrollRunId staffCount totalGross totalNet workingDays }
    }
  }
`;

const SET_STATUS = gql`
  mutation SetPayrollStatus($runId: UUID!, $status: String!) {
    setPayrollStatus(input: { pRunId: $runId, pStatus: $status }) {
      results { id status }
    }
  }
`;

const UPSERT_ATTENDANCE = gql`
  mutation CreateStaffAttendance($a: StaffAttendanceInput!) {
    createStaffAttendance(input: { staffAttendance: $a }) { staffAttendance { id } }
  }
`;
const UPDATE_ATTENDANCE = gql`
  mutation UpdateStaffAttendance($id: UUID!, $patch: StaffAttendancePatch!) {
    updateStaffAttendanceById(input: { id: $id, staffAttendancePatch: $patch }) { staffAttendance { id } }
  }
`;

const STATUS_STYLES = {
  draft: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const monthLabel = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '-';

const FIELD =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

const schoolName = () => {
  try {
    return JSON.parse(localStorage.getItem('institution') || 'null')?.name;
  } catch {
    return undefined;
  }
};

function RunModal({ isOpen, onClose, onSubmit }) {
  const [month, setMonth] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setMonth(new Date().toISOString().slice(0, 7));
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Run Payroll">
      <form
        onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(`${month}-01`); } finally { setSaving(false); } }}
        className="space-y-4"
      >
        <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
          Builds a draft payroll from every active salary structure, applying loss-of-pay from staff
          attendance. Re-running a draft rebuilds it; approved runs are locked.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Payroll month *</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required className={FIELD} />
        </div>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Record loss-of-pay days per staff member before running payroll. */
function AttendanceModal({ isOpen, onClose, onSave, staff, month, existing, workingDays }) {
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRows(Object.fromEntries(staff.map((s) => {
      const rec = existing.find((e) => e.userId === s.id && e.periodMonth === month);
      return [s.id, rec?.unpaidLeaveDays ?? '0'];
    })));
  }, [isOpen, staff, existing, month]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Loss of Pay — ${monthLabel(month)}`} maxWidth="max-w-xl">
      <form
        onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave(rows); } finally { setSaving(false); } }}
        className="space-y-4"
      >
        <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
          {workingDays} working days this month after weekends and holidays. Enter unpaid leave days
          to reduce pay proportionally.
        </p>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-zinc-500">Staff</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-zinc-500">LOP days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-zinc-800">{s.fullName}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number" min="0" max={workingDays} step="0.5"
                      value={rows[s.id] ?? '0'}
                      onChange={(e) => setRows((r) => ({ ...r, [s.id]: e.target.value }))}
                      className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PayrollContent() {
  const { loading, data, refetch } = useQuery(GET_PAYROLL);
  const [generatePayroll] = useMutation(GENERATE);
  const [setStatus] = useMutation(SET_STATUS);
  const [createAttendance] = useMutation(UPSERT_ATTENDANCE);
  const [updateAttendance] = useMutation(UPDATE_ATTENDANCE);

  const [runModal, setRunModal] = useState(false);
  const [attendanceModal, setAttendanceModal] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const runs = useMemo(() => data?.allPayrollRuns?.nodes || [], [data]);
  const summary = data?.payrollSummary?.nodes?.[0];
  const banks = data?.allStaffBankAccounts?.nodes || [];
  const attendance = data?.allStaffAttendances?.nodes || [];
  const active = runs.find((r) => r.id === activeId) || null;

  useEffect(() => {
    if (!activeId && runs.length) setActiveId(runs[0].id);
  }, [runs, activeId]);

  const staffOnPayroll = useMemo(
    () =>
      (active?.payslipsByPayrollRunId?.nodes || []).map((p) => ({
        id: p.userId,
        fullName: p.userByUserId?.fullName,
      })),
    [active]
  );

  const runPayroll = async (month) => {
    try {
      const institutionId = getInstitutionIdFromStorage();
      if (!institutionId) {
        toast.error('Missing institute context. Sign in again from your institute subdomain.');
        return;
      }
      const res = await generatePayroll({ variables: { institutionId, month } });
      const r = res.data?.generatePayroll?.results?.[0];
      if (r?.staffCount === 0) {
        toast('No active salary structures — set them up in the Salary Planner first.');
      } else {
        toast.success(`Payroll drafted for ${r.staffCount} staff · net ${formatInr(r.totalNet)}`);
      }
      setRunModal(false);
      const { data: fresh } = await refetch();
      if (r?.payrollRunId) setActiveId(r.payrollRunId);
      else if (fresh?.allPayrollRuns?.nodes?.length) setActiveId(fresh.allPayrollRuns.nodes[0].id);
    } catch (err) {
      toast.error('Payroll failed: ' + err.message);
    }
  };

  const changeStatus = async (status) => {
    try {
      await setStatus({ variables: { runId: active.id, status } });
      toast.success(status === 'approved' ? 'Payroll approved' : 'Payroll marked as paid');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveAttendance = async (rows) => {
    try {
      const month = active.periodMonth;
      for (const [userId, days] of Object.entries(rows)) {
        const value = parseFloat(days) || 0;
        const existing = attendance.find((a) => a.userId === userId && a.periodMonth === month);
        if (existing) {
          if (parseFloat(existing.unpaidLeaveDays) !== value) {
            await updateAttendance({ variables: { id: existing.id, patch: { unpaidLeaveDays: value } } });
          }
        } else if (value > 0) {
          await createAttendance({
            variables: {
              a: {
                institutionId: getInstitutionIdFromStorage(),
                userId,
                periodMonth: month,
                workingDays: active.workingDays,
                unpaidLeaveDays: value,
              },
            },
          });
        }
      }
      toast.success('Attendance saved — regenerate the draft to apply it');
      setAttendanceModal(false);
      refetch();
    } catch (err) {
      toast.error('Could not save attendance: ' + err.message);
    }
  };

  const downloadPayslip = (slip) => {
    const bank = banks.find((b) => b.userId === slip.userId);
    try {
      generatePayslip({
        schoolName: schoolName(),
        employeeName: slip.userByUserId?.fullName,
        designation: slip.userByUserId?.role,
        periodMonth: slip.period_month || active.periodMonth,
        workingDays: slip.workingDays,
        paidDays: slip.paidDays,
        lopDays: slip.lopDays,
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

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Payroll</h1>
          <p className="text-zinc-500">Run monthly salaries, approve them and issue payslips.</p>
        </div>
        <button
          onClick={() => setRunModal(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 hover:bg-primary-700"
        >
          <Play className="h-4 w-4" /> Run Payroll
        </button>
      </div>

      {summary && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Staff on Payroll" value={summary.staffOnPayroll} icon={Users} color="primary" />
          <StatCard title="Last Run Gross" value={formatInr(summary.monthlyGross)} icon={Wallet} color="blue" />
          <StatCard title="Last Run Net" value={formatInr(summary.monthlyNet)} icon={BadgeCheck} color="green" />
          <StatCard title="Pending Payslips" value={summary.pendingPayslips} icon={CalendarDays} color="yellow" />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">Loading payroll...</div>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No payroll runs yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Set up salary structures in the Salary Planner, then run payroll for a month.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  r.id === activeId ? 'border-primary-500 bg-primary-50/60 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900">{monthLabel(r.periodMonth)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{r.staffCount} staff · {r.workingDays} working days</p>
                <p className="mt-2 text-sm font-semibold text-primary-700">{formatInr(r.totalNet)}</p>
              </button>
            ))}
          </div>

          {active && (
            <motion.div key={active.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-zinc-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-zinc-100 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{monthLabel(active.periodMonth)}</h2>
                  <p className="text-sm text-zinc-500">
                    {active.staffCount} staff · gross {formatInrPrecise(active.totalGross)} · deductions{' '}
                    {formatInrPrecise(active.totalDeductions)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {active.status === 'draft' && (
                    <>
                      <button onClick={() => setAttendanceModal(true)} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                        Loss of Pay
                      </button>
                      <button onClick={() => runPayroll(active.periodMonth)} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                        Rebuild Draft
                      </button>
                      <button onClick={() => changeStatus('approved')} className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                    </>
                  )}
                  {active.status === 'approved' && (
                    <button onClick={() => changeStatus('paid')} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
                      <BadgeCheck className="h-3.5 w-3.5" /> Mark Paid
                    </button>
                  )}
                  {active.status === 'paid' && (
                    <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                      Paid {active.paidAt ? new Date(active.paidAt).toLocaleDateString('en-IN') : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50/50">
                    <tr>
                      {['Staff', 'Working', 'LOP', 'Gross', 'Deductions', 'Net Pay', 'Status', ''].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(active.payslipsByPayrollRunId?.nodes || []).length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">No payslips in this run.</td></tr>
                    ) : (
                      active.payslipsByPayrollRunId.nodes.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50/80">
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-medium text-zinc-900">{p.userByUserId?.fullName}</span>
                            <span className="ml-2 text-xs text-zinc-400">{p.userByUserId?.role}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-600">{p.paidDays} / {p.workingDays}</td>
                          <td className="px-4 py-3 text-sm text-zinc-600">{parseFloat(p.lopDays) > 0 ? p.lopDays : '-'}</td>
                          <td className="px-4 py-3 text-sm text-zinc-900">{formatInrPrecise(p.grossEarnings)}</td>
                          <td className="px-4 py-3 text-sm text-red-600">{formatInrPrecise(p.totalDeductions)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-700">{formatInrPrecise(p.netPay)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${p.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                              {p.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => downloadPayslip(p)} title="Download payslip" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-primary-600">
                              <Download className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
                <span className="text-sm text-zinc-500">Total net payable</span>
                <span className="text-lg font-bold text-zinc-900">{formatInrPrecise(active.totalNet)}</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <RunModal isOpen={runModal} onClose={() => setRunModal(false)} onSubmit={runPayroll} />
      {active && (
        <AttendanceModal
          isOpen={attendanceModal}
          onClose={() => setAttendanceModal(false)}
          onSave={saveAttendance}
          staff={staffOnPayroll}
          month={active.periodMonth}
          existing={attendance}
          workingDays={active.workingDays}
        />
      )}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <ApolloWrapper>
      <PayrollContent />
    </ApolloWrapper>
  );
}
