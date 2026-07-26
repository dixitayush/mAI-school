"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Plus, Trash2, Wallet, Landmark, UserCog } from 'lucide-react';
import { getInstitutionIdFromStorage } from '@/lib/tenant';
import { formatInr, formatInrPrecise } from '@/lib/currency';

const GET_DATA = gql`
  query GetSalaryStructures {
    allSalaryStructures(orderBy: EFFECTIVE_FROM_DESC) {
      nodes {
        id
        userId
        name
        effectiveFrom
        effectiveTo
        annualCtc
        basicMonthly
        paymentMode
        isActive
        notes
        userByUserId { id fullName role }
        salaryComponentsBySalaryStructureId {
          nodes {
            id
            name
            code
            componentType
            calculation
            value
            prorateOnLop
            sortOrder
          }
        }
      }
    }
    allUsers {
      nodes { id fullName role }
    }
    allStaffBankAccounts {
      nodes {
        id
        userId
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

const CREATE_STRUCTURE = gql`
  mutation CreateStructure($s: SalaryStructureInput!) {
    createSalaryStructure(input: { salaryStructure: $s }) { salaryStructure { id } }
  }
`;
const UPDATE_STRUCTURE = gql`
  mutation UpdateStructure($id: UUID!, $patch: SalaryStructurePatch!) {
    updateSalaryStructureById(input: { id: $id, salaryStructurePatch: $patch }) { salaryStructure { id } }
  }
`;
const DELETE_STRUCTURE = gql`
  mutation DeleteStructure($id: UUID!) {
    deleteSalaryStructureById(input: { id: $id }) { deletedSalaryStructureId }
  }
`;
const CREATE_COMPONENT = gql`
  mutation CreateComponent($c: SalaryComponentInput!) {
    createSalaryComponent(input: { salaryComponent: $c }) { salaryComponent { id } }
  }
`;
const DELETE_COMPONENT = gql`
  mutation DeleteComponent($id: UUID!) {
    deleteSalaryComponentById(input: { id: $id }) { deletedSalaryComponentId }
  }
`;
const UPSERT_BANK = gql`
  mutation CreateBank($b: StaffBankAccountInput!) {
    createStaffBankAccount(input: { staffBankAccount: $b }) { staffBankAccount { id } }
  }
`;
const UPDATE_BANK = gql`
  mutation UpdateBank($id: UUID!, $patch: StaffBankAccountPatch!) {
    updateStaffBankAccountById(input: { id: $id, staffBankAccountPatch: $patch }) { staffBankAccount { id } }
  }
`;

const CALCULATIONS = [
  ['fixed', 'Fixed amount'],
  ['percent_of_basic', '% of basic'],
  ['percent_of_ctc', '% of monthly CTC'],
];

const FIELD =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

/** Mirrors salary_structure_preview() in the database. */
function resolveAmount(component, structure) {
  const v = parseFloat(component.value || 0);
  const basic = parseFloat(structure.basicMonthly || 0);
  const ctcMonthly = parseFloat(structure.annualCtc || 0) / 12;
  if (component.calculation === 'percent_of_basic') return (basic * v) / 100;
  if (component.calculation === 'percent_of_ctc') return (ctcMonthly * v) / 100;
  return v;
}

function StructureModal({ isOpen, onClose, onSubmit, structure, staff }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      structure
        ? {
            userId: structure.userId,
            name: structure.name || '',
            effectiveFrom: structure.effectiveFrom,
            effectiveTo: structure.effectiveTo || '',
            annualCtc: structure.annualCtc,
            basicMonthly: structure.basicMonthly,
            paymentMode: structure.paymentMode,
            isActive: structure.isActive,
            notes: structure.notes || '',
          }
        : {
            userId: '',
            name: '',
            effectiveFrom: new Date().toISOString().slice(0, 10),
            effectiveTo: '',
            annualCtc: '',
            basicMonthly: '',
            paymentMode: 'bank_transfer',
            isActive: true,
            notes: '',
          }
    );
  }, [isOpen, structure]);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      // Basic defaults to the common 50% of CTC until the planner overrides it.
      if (name === 'annualCtc' && !structure && !f.basicMonthly) {
        next.basicMonthly = value ? ((parseFloat(value) / 12) * 0.5).toFixed(2) : '';
      }
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={structure ? 'Edit Salary Structure' : 'New Salary Structure'} maxWidth="max-w-lg">
      <form
        onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(form); } finally { setSaving(false); } }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Staff member *</label>
          <select name="userId" value={form.userId || ''} onChange={change} required disabled={Boolean(structure)} className={`${FIELD} bg-white disabled:bg-zinc-100`}>
            <option value="">Select staff</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Grade / plan name</label>
          <input name="name" value={form.name || ''} onChange={change} className={FIELD} placeholder="Senior Teacher Grade II" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Annual CTC (Rs.) *</label>
            <input type="number" name="annualCtc" value={form.annualCtc || ''} onChange={change} required min="0" step="0.01" className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Monthly basic (Rs.) *</label>
            <input type="number" name="basicMonthly" value={form.basicMonthly || ''} onChange={change} required min="0" step="0.01" className={FIELD} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Effective from *</label>
            <input type="date" name="effectiveFrom" value={form.effectiveFrom || ''} onChange={change} required className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Effective to</label>
            <input type="date" name="effectiveTo" value={form.effectiveTo || ''} onChange={change} className={FIELD} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Payment mode</label>
          <select name="paymentMode" value={form.paymentMode || 'bank_transfer'} onChange={change} className={`${FIELD} bg-white`}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="isActive" checked={form.isActive ?? true} onChange={change} className="rounded" />
          Active
        </label>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : structure ? 'Save Changes' : 'Create Structure'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ComponentModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', code: '', componentType: 'earning', calculation: 'fixed', value: '', prorateOnLop: true, sortOrder: 100 });
    }
  }, [isOpen]);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Salary Component">
      <form
        onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(form); } finally { setSaving(false); } }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Name *</label>
            <input name="name" value={form.name || ''} onChange={change} required className={FIELD} placeholder="House Rent Allowance" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Code *</label>
            <input name="code" value={form.code || ''} onChange={change} required className={FIELD} placeholder="HRA" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Type *</label>
            <select name="componentType" value={form.componentType || 'earning'} onChange={change} className={`${FIELD} bg-white`}>
              <option value="earning">Earning</option>
              <option value="deduction">Deduction</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Calculation *</label>
            <select name="calculation" value={form.calculation || 'fixed'} onChange={change} className={`${FIELD} bg-white`}>
              {CALCULATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            {form.calculation === 'fixed' ? 'Amount (Rs.) *' : 'Percentage *'}
          </label>
          <input type="number" name="value" value={form.value || ''} onChange={change} required min="0" step="0.01" className={FIELD} />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="prorateOnLop" checked={form.prorateOnLop ?? true} onChange={change} className="rounded" />
          Reduce proportionally for loss-of-pay days
        </label>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add Component'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BankModal({ isOpen, onClose, onSubmit, account, staffName }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      account || {
        accountHolderName: staffName || '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        branchName: '',
        upiId: '',
        panNumber: '',
        pfNumber: '',
      }
    );
  }, [isOpen, account, staffName]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bank & Statutory Details" maxWidth="max-w-lg">
      <form
        onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(form); } finally { setSaving(false); } }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Account holder name *</label>
          <input name="accountHolderName" value={form.accountHolderName || ''} onChange={change} required className={FIELD} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Account number *</label>
            <input name="accountNumber" value={form.accountNumber || ''} onChange={change} required className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">IFSC code *</label>
            <input name="ifscCode" value={form.ifscCode || ''} onChange={change} required className={`${FIELD} uppercase`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Bank</label>
            <input name="bankName" value={form.bankName || ''} onChange={change} className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Branch</label>
            <input name="branchName" value={form.branchName || ''} onChange={change} className={FIELD} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">UPI ID</label>
            <input name="upiId" value={form.upiId || ''} onChange={change} className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">PAN</label>
            <input name="panNumber" value={form.panNumber || ''} onChange={change} className={`${FIELD} uppercase`} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">UAN / PF</label>
            <input name="pfNumber" value={form.pfNumber || ''} onChange={change} className={FIELD} />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StructuresContent() {
  const { loading, data, refetch } = useQuery(GET_DATA);
  const [createStructure] = useMutation(CREATE_STRUCTURE);
  const [updateStructure] = useMutation(UPDATE_STRUCTURE);
  const [deleteStructure] = useMutation(DELETE_STRUCTURE);
  const [createComponent] = useMutation(CREATE_COMPONENT);
  const [deleteComponent] = useMutation(DELETE_COMPONENT);
  const [createBank] = useMutation(UPSERT_BANK);
  const [updateBank] = useMutation(UPDATE_BANK);

  const [structureModal, setStructureModal] = useState(false);
  const [componentModal, setComponentModal] = useState(false);
  const [bankModal, setBankModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const structures = useMemo(() => data?.allSalaryStructures?.nodes || [], [data]);
  // Students are not on payroll.
  const staff = useMemo(
    () => (data?.allUsers?.nodes || []).filter((u) => u.role !== 'student' && u.role !== 'mai_admin'),
    [data]
  );
  const banks = data?.allStaffBankAccounts?.nodes || [];
  const active = structures.find((s) => s.id === activeId) || null;
  const activeBank = active ? banks.find((b) => b.userId === active.userId) : null;

  useEffect(() => {
    if (!activeId && structures.length) setActiveId(structures[0].id);
  }, [structures, activeId]);

  const totals = useMemo(() => {
    if (!active) return { gross: 0, deductions: 0, net: 0 };
    const comps = active.salaryComponentsBySalaryStructureId?.nodes || [];
    const gross = comps.filter((c) => c.componentType === 'earning').reduce((s, c) => s + resolveAmount(c, active), 0);
    const ded = comps.filter((c) => c.componentType === 'deduction').reduce((s, c) => s + resolveAmount(c, active), 0);
    return { gross, deductions: ded, net: gross - ded };
  }, [active]);

  const saveStructure = async (form) => {
    try {
      const payload = {
        name: form.name || null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        annualCtc: form.annualCtc,
        basicMonthly: form.basicMonthly,
        paymentMode: form.paymentMode,
        isActive: form.isActive,
        notes: form.notes || null,
      };
      if (editing) {
        await updateStructure({ variables: { id: editing.id, patch: payload } });
        toast.success('Structure updated');
      } else {
        const institutionId = getInstitutionIdFromStorage();
        if (!institutionId) {
          toast.error('Missing institute context. Sign in again from your institute subdomain.');
          return;
        }
        await createStructure({ variables: { s: { ...payload, institutionId, userId: form.userId } } });
        toast.success('Structure created');
      }
      setStructureModal(false);
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const addComponent = async (form) => {
    try {
      await createComponent({
        variables: {
          c: {
            salaryStructureId: activeId,
            name: form.name,
            code: form.code.trim().toUpperCase(),
            componentType: form.componentType,
            calculation: form.calculation,
            value: form.value,
            prorateOnLop: form.prorateOnLop,
            sortOrder: parseInt(form.sortOrder, 10) || 100,
          },
        },
      });
      toast.success('Component added');
      setComponentModal(false);
      refetch();
    } catch (err) {
      toast.error(
        err.message.includes('duplicate')
          ? 'A component with that code already exists on this structure.'
          : 'Error: ' + err.message
      );
    }
  };

  const saveBank = async (form) => {
    try {
      if (activeBank) {
        await updateBank({ variables: { id: activeBank.id, patch: form } });
      } else {
        const institutionId = getInstitutionIdFromStorage();
        await createBank({ variables: { b: { ...form, institutionId, userId: active.userId } } });
      }
      toast.success('Bank details saved');
      setBankModal(false);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Salary Planner</h1>
          <p className="text-zinc-500">
            Design each staff member&apos;s compensation from earning and deduction components.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setStructureModal(true); }}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Structure
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">Loading salary structures...</div>
      ) : structures.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <UserCog className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No salary structures yet</p>
          <p className="mt-1 text-sm text-zinc-500">Create one per staff member to enable payroll.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            {structures.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  s.id === activeId ? 'border-primary-500 bg-primary-50/60 shadow-sm' : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-900">{s.userByUserId?.fullName}</span>
                  {!s.isActive && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">Inactive</span>}
                </div>
                <p className="mt-1 text-xs text-zinc-500">{s.name || s.userByUserId?.role}</p>
                <p className="mt-2 text-sm font-semibold text-primary-700">{formatInr(s.annualCtc)} / yr</p>
              </button>
            ))}
          </div>

          {active && (
            <motion.div key={active.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-zinc-100 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">{active.userByUserId?.fullName}</h2>
                    <p className="text-sm text-zinc-500">
                      {active.name || 'Salary structure'} · effective {new Date(active.effectiveFrom).toLocaleDateString('en-IN')}
                      {active.effectiveTo ? ` to ${new Date(active.effectiveTo).toLocaleDateString('en-IN')}` : ' onwards'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setBankModal(true)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                      <Landmark className="h-3.5 w-3.5" /> Bank Details
                    </button>
                    <button onClick={() => { setEditing(active); setStructureModal(true); }} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                      Edit
                    </button>
                    <button onClick={() => setComponentModal(true)} className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700">
                      <Plus className="h-3.5 w-3.5" /> Component
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete the salary structure for ${active.userByUserId?.fullName}?`)) return;
                        try {
                          await deleteStructure({ variables: { id: active.id } });
                          toast.success('Structure deleted');
                          setActiveId(null);
                          refetch();
                        } catch (err) { toast.error('Failed: ' + err.message); }
                      }}
                      className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-zinc-100 p-6 sm:grid-cols-4">
                  {[
                    ['Annual CTC', formatInr(active.annualCtc)],
                    ['Monthly Basic', formatInr(active.basicMonthly)],
                    ['Gross / month', formatInr(totals.gross)],
                    ['Net / month', formatInr(totals.net)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
                      <p className="mt-1 text-lg font-bold text-zinc-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50/50">
                      <tr>
                        {['Component', 'Type', 'Calculation', 'Configured', 'Monthly', ''].map((h) => (
                          <th key={h} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(active.salaryComponentsBySalaryStructureId?.nodes || []).length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-zinc-500">No components yet. Add Basic, HRA, PF and so on.</td></tr>
                      ) : (
                        [...active.salaryComponentsBySalaryStructureId.nodes]
                          .sort((a, b) => (a.componentType === b.componentType ? a.sortOrder - b.sortOrder : a.componentType === 'earning' ? -1 : 1))
                          .map((c) => (
                            <tr key={c.id} className="hover:bg-zinc-50/80">
                              <td className="px-6 py-3">
                                <span className="font-medium text-zinc-900">{c.name}</span>
                                <span className="ml-2 text-xs text-zinc-400">{c.code}</span>
                                {!c.prorateOnLop && (
                                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">No LOP</span>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${c.componentType === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {c.componentType}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-sm text-zinc-600">
                                {CALCULATIONS.find(([v]) => v === c.calculation)?.[1]}
                              </td>
                              <td className="px-6 py-3 text-sm text-zinc-600">
                                {c.calculation === 'fixed' ? formatInrPrecise(c.value) : `${c.value}%`}
                              </td>
                              <td className="px-6 py-3 text-sm font-semibold text-zinc-900">
                                {formatInrPrecise(resolveAmount(c, active))}
                              </td>
                              <td className="px-6 py-3 text-right">
                                <button
                                  onClick={async () => {
                                    try {
                                      await deleteComponent({ variables: { id: c.id } });
                                      toast.success('Component removed');
                                      refetch();
                                    } catch (err) { toast.error('Failed: ' + err.message); }
                                  }}
                                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
                  <div className="flex gap-6 text-sm">
                    <span className="text-zinc-500">Gross <span className="font-semibold text-zinc-900">{formatInrPrecise(totals.gross)}</span></span>
                    <span className="text-zinc-500">Deductions <span className="font-semibold text-red-600">{formatInrPrecise(totals.deductions)}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <span className="text-lg font-bold text-green-700">{formatInrPrecise(totals.net)}</span>
                  </div>
                </div>
              </div>

              {activeBank && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                    <Landmark className="h-4 w-4" /> Bank &amp; Statutory
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    {[
                      ['Account holder', activeBank.accountHolderName],
                      ['Account number', activeBank.accountNumber],
                      ['IFSC', activeBank.ifscCode],
                      ['Bank', activeBank.bankName || '-'],
                      ['Branch', activeBank.branchName || '-'],
                      ['UPI', activeBank.upiId || '-'],
                      ['PAN', activeBank.panNumber || '-'],
                      ['UAN / PF', activeBank.pfNumber || '-'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
                        <p className="mt-0.5 font-medium text-zinc-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      <StructureModal isOpen={structureModal} onClose={() => { setStructureModal(false); setEditing(null); }} onSubmit={saveStructure} structure={editing} staff={staff} />
      <ComponentModal isOpen={componentModal} onClose={() => setComponentModal(false)} onSubmit={addComponent} />
      <BankModal isOpen={bankModal} onClose={() => setBankModal(false)} onSubmit={saveBank} account={activeBank} staffName={active?.userByUserId?.fullName} />
    </div>
  );
}

export default function SalaryStructuresPage() {
  return (
    <ApolloWrapper>
      <StructuresContent />
    </ApolloWrapper>
  );
}
