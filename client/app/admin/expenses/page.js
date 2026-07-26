"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import FileUpload from '@/components/FileUpload';
import { toast } from 'react-hot-toast';
import {
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Send,
  Trash2,
  XCircle,
  Pencil,
  Tags,
} from 'lucide-react';
import { formatInr } from '@/lib/currency';
import { fetchFileObjectUrl } from '@/lib/api';
import { getInstitutionIdFromStorage } from '@/lib/tenant';

const GET_EXPENSES = gql`
  query GetExpenses {
    allExpenses(orderBy: EXPENSE_DATE_DESC) {
      nodes {
        id
        title
        description
        vendorName
        vendorGstin
        billNumber
        billFileId
        amount
        taxAmount
        totalAmount
        expenseDate
        paymentMode
        paymentReference
        status
        rejectionReason
        notes
        expenseCategoryId
        expenseCategoryByExpenseCategoryId {
          id
          name
        }
        userByRequestedBy {
          fullName
        }
        userByApprovedBy {
          fullName
        }
      }
    }
    allExpenseCategories(orderBy: SORT_ORDER_ASC) {
      nodes {
        id
        name
        code
        monthlyBudget
        isActive
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
    expenseByCategory {
      nodes {
        categoryId
        categoryName
        spentThisYear
        monthlyBudget
        expenseCount
      }
    }
  }
`;

const CREATE_EXPENSE = gql`
  mutation CreateExpense($expense: ExpenseInput!) {
    createExpense(input: { expense: $expense }) {
      expense {
        id
      }
    }
  }
`;

const UPDATE_EXPENSE = gql`
  mutation UpdateExpense($id: UUID!, $patch: ExpensePatch!) {
    updateExpenseById(input: { id: $id, expensePatch: $patch }) {
      expense {
        id
      }
    }
  }
`;

const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: UUID!) {
    deleteExpenseById(input: { id: $id }) {
      deletedExpenseId
    }
  }
`;

const SET_STATUS = gql`
  mutation SetExpenseStatus($id: UUID!, $status: String!, $reason: String) {
    setExpenseStatus(input: { pExpenseId: $id, pStatus: $status, pReason: $reason }) {
      results {
        id
        status
      }
    }
  }
`;

const CREATE_CATEGORY = gql`
  mutation CreateExpenseCategory($category: ExpenseCategoryInput!) {
    createExpenseCategory(input: { expenseCategory: $category }) {
      expenseCategory {
        id
      }
    }
  }
`;

const UPDATE_CATEGORY = gql`
  mutation UpdateExpenseCategory($id: UUID!, $patch: ExpenseCategoryPatch!) {
    updateExpenseCategoryById(input: { id: $id, expenseCategoryPatch: $patch }) {
      expenseCategory {
        id
      }
    }
  }
`;

const PAYMENT_MODES = [
  ['', 'Not set'],
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['card', 'Card'],
  ['cheque', 'Cheque'],
  ['dd', 'Demand draft'],
  ['bank_transfer', 'Bank transfer'],
];

const STATUS_STYLE = {
  draft: 'bg-zinc-100 text-zinc-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
};

const FILTERS = ['all', 'draft', 'pending', 'approved', 'rejected', 'paid'];

const field =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

const EMPTY = {
  title: '',
  description: '',
  expenseCategoryId: '',
  vendorName: '',
  vendorGstin: '',
  billNumber: '',
  billFileId: null,
  amount: '',
  taxAmount: '0',
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMode: '',
  paymentReference: '',
  notes: '',
};

function ExpenseModal({ isOpen, onClose, onSubmit, expense, categories }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      expense
        ? {
            ...EMPTY,
            ...expense,
            expenseCategoryId: expense.expenseCategoryId || '',
            paymentMode: expense.paymentMode || '',
            expenseDate: (expense.expenseDate || '').slice(0, 10),
          }
        : EMPTY
    );
  }, [isOpen, expense]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const total = (parseFloat(form.amount) || 0) + (parseFloat(form.taxAmount) || 0);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={expense ? 'Edit Expense' : 'Record Expense'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Title *</label>
          <input name="title" value={form.title} onChange={change} required className={field} placeholder="July electricity bill" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Category</label>
            <select name="expenseCategoryId" value={form.expenseCategoryId} onChange={change} className={`${field} bg-white`}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Expense date *</label>
            <input type="date" name="expenseDate" value={form.expenseDate} onChange={change} required className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Vendor</label>
            <input name="vendorName" value={form.vendorName || ''} onChange={change} className={field} placeholder="State Power Co" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Vendor GSTIN</label>
            <input name="vendorGstin" value={form.vendorGstin || ''} onChange={change} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Amount (Rs.) *</label>
            <input type="number" step="0.01" min="0" name="amount" value={form.amount} onChange={change} required className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Tax (Rs.)</label>
            <input type="number" step="0.01" min="0" name="taxAmount" value={form.taxAmount} onChange={change} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Total</label>
            <div className="rounded-lg bg-zinc-100 px-3 py-2 font-semibold text-zinc-800">{formatInr(total)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Payment mode</label>
            <select name="paymentMode" value={form.paymentMode} onChange={change} className={`${field} bg-white`}>
              {PAYMENT_MODES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Payment reference</label>
            <input name="paymentReference" value={form.paymentReference || ''} onChange={change} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Bill number</label>
            <input name="billNumber" value={form.billNumber || ''} onChange={change} className={field} placeholder="EB-7781" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Bill copy</label>
            <FileUpload
              kind="expense_bill"
              accept="image/*,application/pdf"
              label={form.billFileId ? 'Replace bill' : 'Attach bill'}
              onUploaded={(f) => setForm((s) => ({ ...s, billFileId: f.id }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
          <textarea name="notes" value={form.notes || ''} onChange={change} rows={2} className={field} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : expense ? 'Save Changes' : 'Record Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ isOpen, onClose, categories, onCreate, onUpdate }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({ name, code, monthlyBudget: budget });
      setName('');
      setCode('');
      setBudget('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Expense Categories">
      <div className="space-y-5">
        <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2 text-right">Monthly budget</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-zinc-800">{c.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.code}</td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {c.monthlyBudget ? formatInr(c.monthlyBudget) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onUpdate(c.id, { isActive: !c.isActive })}
                      className="text-xs font-medium text-primary-600 hover:underline"
                    >
                      {c.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No categories yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={add} className="grid grid-cols-4 items-end gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">New category</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={field} placeholder="Lab equipment" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required className={field} placeholder="LAB" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Budget / mo</label>
            <input type="number" step="0.01" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
          </div>
          <div className="col-span-4">
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Category'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function RejectModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Expense">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(reason);
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Reason *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className={field} placeholder="Duplicate of bill EB-7780" />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
          <button type="submit" className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
            Reject
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExpensesContent() {
  const { loading, data, refetch } = useQuery(GET_EXPENSES);
  const [createExpense] = useMutation(CREATE_EXPENSE);
  const [updateExpense] = useMutation(UPDATE_EXPENSE);
  const [deleteExpense] = useMutation(DELETE_EXPENSE);
  const [setStatus] = useMutation(SET_STATUS);
  const [createCategory] = useMutation(CREATE_CATEGORY);
  const [updateCategory] = useMutation(UPDATE_CATEGORY);

  const [modalOpen, setModalOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  // Sign-off is restricted to admin and principal in set_expense_status, so an
  // ops admin records and submits but never approves their own spending.
  const [role, setRole] = useState(null);
  useEffect(() => setRole(localStorage.getItem('role')), []);
  const canApprove = ['admin', 'principal', 'mai_admin'].includes(role);

  const expenses = data?.allExpenses?.nodes || [];
  const categories = data?.allExpenseCategories?.nodes || [];
  const summary = data?.expenseSummary?.nodes?.[0];
  const byCategory = (data?.expenseByCategory?.nodes || []).filter((c) => Number(c.spentThisYear) > 0);

  const visible = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.status === filter)),
    [expenses, filter]
  );

  const counts = useMemo(() => {
    const acc = { all: expenses.length };
    for (const e of expenses) acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, [expenses]);

  const save = async (form) => {
    const payload = {
      title: form.title,
      description: form.description || null,
      expenseCategoryId: form.expenseCategoryId || null,
      vendorName: form.vendorName || null,
      vendorGstin: form.vendorGstin || null,
      billNumber: form.billNumber || null,
      billFileId: form.billFileId || null,
      amount: String(parseFloat(form.amount) || 0),
      taxAmount: String(parseFloat(form.taxAmount) || 0),
      expenseDate: form.expenseDate,
      paymentMode: form.paymentMode || null,
      paymentReference: form.paymentReference || null,
      notes: form.notes || null,
    };
    try {
      if (selected) {
        await updateExpense({ variables: { id: selected.id, patch: payload } });
        toast.success('Expense updated');
      } else {
        const institutionId = getInstitutionIdFromStorage();
        if (!institutionId) {
          toast.error('Missing institute context. Sign in again from your institute subdomain.');
          return;
        }
        await createExpense({ variables: { expense: { ...payload, institutionId } } });
        toast.success('Expense recorded');
      }
      setModalOpen(false);
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const move = async (row, status, reason) => {
    setBusyId(row.id);
    try {
      await setStatus({ variables: { id: row.id, status, reason: reason || null } });
      toast.success(`Expense ${status}`);
      setRejecting(null);
      refetch();
    } catch (err) {
      toast.error(err.message.replace(/^.*?:\s*/, ''));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    try {
      await deleteExpense({ variables: { id: row.id } });
      toast.success('Expense deleted');
      refetch();
    } catch (err) {
      toast.error('Could not delete: ' + err.message);
    }
  };

  const viewBill = async (fileId) => {
    const url = await fetchFileObjectUrl(fileId);
    if (!url) {
      toast.error('Bill could not be loaded');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const addCategory = async ({ name, code, monthlyBudget }) => {
    const institutionId = getInstitutionIdFromStorage();
    if (!institutionId) {
      toast.error('Missing institute context.');
      return;
    }
    try {
      await createCategory({
        variables: {
          category: {
            institutionId,
            name,
            code: code.trim().toUpperCase(),
            monthlyBudget: monthlyBudget ? String(parseFloat(monthlyBudget)) : null,
            sortOrder: 100,
          },
        },
      });
      toast.success('Category added');
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const patchCategory = async (id, patch) => {
    try {
      await updateCategory({ variables: { id, patch } });
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Expenses</h1>
          <p className="text-zinc-500">
            Record school spending, attach the bill and take it through approval to payment.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCatOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <Tags className="h-4 w-4" /> Categories
          </button>
          <button
            onClick={() => { setSelected(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Record Expense
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Spent This Month" value={formatInr(summary?.spentThisMonth || 0)} icon={Banknote} color="primary" />
        <StatCard title="Spent This Year" value={formatInr(summary?.spentThisYear || 0)} icon={Receipt} color="blue" />
        <StatCard title="Awaiting Approval" value={formatInr(summary?.pendingAmount || 0)} subtitle={`${summary?.pendingCount || 0} bills`} icon={Clock} color="yellow" />
        <StatCard title="Approved, Unpaid" value={formatInr(summary?.approvedUnpaid || 0)} icon={CheckCircle2} color="green" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {f} {counts[f] ? `(${counts[f]})` : ''}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3">Expense</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Vendor</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No expenses {filter === 'all' ? 'recorded yet' : `with status "${filter}"`}.
                  </td>
                </tr>
              )}
              {visible.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50/60">
                  <td className="px-6 py-3">
                    <div className="font-medium text-zinc-900">{e.title}</div>
                    <div className="text-xs text-zinc-500">
                      {e.billNumber ? `Bill ${e.billNumber}` : 'No bill number'}
                      {e.userByRequestedBy ? ` · by ${e.userByRequestedBy.fullName}` : ''}
                    </div>
                    {e.status === 'rejected' && e.rejectionReason && (
                      <div className="mt-1 text-xs text-red-600">Rejected: {e.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-zinc-600">{e.expenseCategoryByExpenseCategoryId?.name || '—'}</td>
                  <td className="px-6 py-3 text-zinc-600">{e.vendorName || '—'}</td>
                  <td className="px-6 py-3 text-zinc-600">{e.expenseDate}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="font-semibold text-zinc-900">{formatInr(e.totalAmount)}</div>
                    {Number(e.taxAmount) > 0 && (
                      <div className="text-xs text-zinc-500">incl. tax {formatInr(e.taxAmount)}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {e.billFileId && (
                        <button onClick={() => viewBill(e.billFileId)} title="View bill" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      {(e.status === 'draft' || e.status === 'rejected') && (
                        <button onClick={() => move(e, 'pending')} disabled={busyId === e.id} title="Submit for approval" className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-50">
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {e.status === 'pending' &&
                        (canApprove ? (
                          <>
                            <button onClick={() => move(e, 'approved')} disabled={busyId === e.id} title="Approve" className="rounded-lg p-2 text-green-600 hover:bg-green-50 disabled:opacity-50">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => setRejecting(e)} title="Reject" className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-500">Awaiting admin sign-off</span>
                        ))}
                      {e.status === 'approved' && (
                        <button onClick={() => move(e, 'paid')} disabled={busyId === e.id} title="Mark paid" className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                          Mark Paid
                        </button>
                      )}
                      {e.status !== 'paid' && (
                        <>
                          <button onClick={() => { setSelected(e); setModalOpen(true); }} title="Edit" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove(e)} title="Delete" className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Spend by category, year to date</h2>
          <div className="space-y-3">
            {byCategory.map((c) => {
              const spent = Number(c.spentThisYear);
              const max = Math.max(...byCategory.map((x) => Number(x.spentThisYear)), 1);
              return (
                <div key={c.categoryId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-zinc-700">{c.categoryName}</span>
                    <span className="font-medium text-zinc-900">{formatInr(spent)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${(spent / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onSubmit={save}
        expense={selected}
        categories={categories}
      />
      <CategoryModal
        isOpen={catOpen}
        onClose={() => setCatOpen(false)}
        categories={categories}
        onCreate={addCategory}
        onUpdate={patchCategory}
      />
      <RejectModal
        isOpen={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => move(rejecting, 'rejected', reason)}
      />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <ApolloWrapper>
      <ExpensesContent />
    </ApolloWrapper>
  );
}
