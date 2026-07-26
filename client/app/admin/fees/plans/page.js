"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Plus, Trash2, Layers, Play, Pencil } from 'lucide-react';
import { getInstitutionIdFromStorage } from '@/lib/tenant';
import { formatInrPrecise } from '@/lib/currency';

const GET_PLANS = gql`
  query GetFeePlans {
    allFeePlans {
      nodes {
        id
        name
        description
        isActive
        classId
        classByClassId {
          id
          name
        }
        feePlanItemsByFeePlanId {
          nodes {
            id
            amount
            frequency
            dueDay
            isOptional
            feeHeadId
            feeHeadByFeeHeadId {
              id
              name
              code
            }
          }
        }
      }
    }
    allClasses {
      nodes {
        id
        name
      }
    }
    allFeeHeads(condition: { isActive: true }) {
      nodes {
        id
        name
        code
        defaultFrequency
      }
    }
  }
`;

const CREATE_PLAN = gql`
  mutation CreateFeePlan($plan: FeePlanInput!) {
    createFeePlan(input: { feePlan: $plan }) {
      feePlan { id }
    }
  }
`;

const UPDATE_PLAN = gql`
  mutation UpdateFeePlan($id: UUID!, $patch: FeePlanPatch!) {
    updateFeePlanById(input: { id: $id, feePlanPatch: $patch }) {
      feePlan { id }
    }
  }
`;

const DELETE_PLAN = gql`
  mutation DeleteFeePlan($id: UUID!) {
    deleteFeePlanById(input: { id: $id }) {
      deletedFeePlanId
    }
  }
`;

const CREATE_ITEM = gql`
  mutation CreateFeePlanItem($item: FeePlanItemInput!) {
    createFeePlanItem(input: { feePlanItem: $item }) {
      feePlanItem { id }
    }
  }
`;

const DELETE_ITEM = gql`
  mutation DeleteFeePlanItem($id: UUID!) {
    deleteFeePlanItemById(input: { id: $id }) {
      deletedFeePlanItemId
    }
  }
`;

const GENERATE = gql`
  mutation GenerateInvoices($planId: UUID!, $period: String!, $dueDate: Date, $frequency: String) {
    generateInvoicesForPlan(
      input: { pPlanId: $planId, pPeriodLabel: $period, pDueDate: $dueDate, pFrequency: $frequency }
    ) {
      results {
        invoicesCreated
        linesCreated
        studentsSkipped
        totalBilled
      }
    }
  }
`;

const FREQUENCIES = [
  ['one_time', 'One time'],
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['half_yearly', 'Half yearly'],
  ['yearly', 'Yearly'],
];
const freqLabel = (v) => FREQUENCIES.find(([f]) => f === v)?.[1] || v;

const FIELD =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

function PlanModal({ isOpen, onClose, onSubmit, plan, classes }) {
  const [form, setForm] = useState({ name: '', description: '', classId: '', isActive: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      plan
        ? {
            name: plan.name,
            description: plan.description || '',
            classId: plan.classId || '',
            isActive: plan.isActive,
          }
        : { name: '', description: '', classId: '', isActive: true }
    );
  }, [isOpen, plan]);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={plan ? 'Edit Fee Plan' : 'New Fee Plan'}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try { await onSubmit(form); } finally { setSaving(false); }
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Plan name *</label>
          <input name="name" value={form.name} onChange={change} required className={FIELD} placeholder="Session 2026-27 — Class 10" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Applies to class</label>
          <select name="classId" value={form.classId} onChange={change} className={`${FIELD} bg-white`}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Leave blank to bill every student in the institute.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
          <input name="description" value={form.description} onChange={change} className={FIELD} />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} className="rounded" />
          Active
        </label>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : plan ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ItemModal({ isOpen, onClose, onSubmit, heads }) {
  const [form, setForm] = useState({ feeHeadId: '', amount: '', frequency: 'monthly', dueDay: '', isOptional: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm({ feeHeadId: '', amount: '', frequency: 'monthly', dueDay: '', isOptional: false });
  }, [isOpen]);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      // Default the cadence to whatever the chosen head normally uses.
      if (name === 'feeHeadId') {
        next.frequency = heads.find((h) => h.id === value)?.defaultFrequency || f.frequency;
      }
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Fee Head to Plan">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try { await onSubmit(form); } finally { setSaving(false); }
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Fee head *</label>
          <select name="feeHeadId" value={form.feeHeadId} onChange={change} required className={`${FIELD} bg-white`}>
            <option value="">Select a fee head</option>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Amount (Rs.) *</label>
            <input type="number" name="amount" value={form.amount} onChange={change} required min="0" step="0.01" className={FIELD} placeholder="2500.00" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Frequency *</label>
            <select name="frequency" value={form.frequency} onChange={change} className={`${FIELD} bg-white`}>
              {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Due day of month</label>
          <input type="number" name="dueDay" value={form.dueDay} onChange={change} min="1" max="28" className={FIELD} placeholder="10" />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="isOptional" checked={form.isOptional} onChange={change} className="rounded" />
          Optional (not billed automatically)
        </label>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add to Plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function GenerateModal({ isOpen, onClose, onSubmit, plan }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [form, setForm] = useState({ period: thisMonth, frequency: 'monthly', dueDate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const due = new Date();
      due.setDate(due.getDate() + 15);
      setForm({ period: thisMonth, frequency: 'monthly', dueDate: due.toISOString().slice(0, 10) });
    }
  }, [isOpen, thisMonth]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Invoices">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try { await onSubmit(form); } finally { setSaving(false); }
        }}
        className="space-y-4"
      >
        <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
          Raises one invoice per student covered by <span className="font-semibold text-zinc-900">{plan?.name}</span>.
          Students who already have an invoice for this period are skipped, so it is safe to run again.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Period label *</label>
          <input name="period" value={form.period} onChange={change} required className={FIELD} placeholder="2026-04" />
          <p className="mt-1 text-xs text-zinc-500">Use 2026-04 for a month, or 2026-27 for a full session.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Bill items with frequency</label>
            <select name="frequency" value={form.frequency} onChange={change} className={`${FIELD} bg-white`}>
              <option value="">All items</option>
              {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Due date *</label>
            <input type="date" name="dueDate" value={form.dueDate} onChange={change} required className={FIELD} />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FeePlansContent() {
  const { loading, data, refetch } = useQuery(GET_PLANS);
  const [createPlan] = useMutation(CREATE_PLAN);
  const [updatePlan] = useMutation(UPDATE_PLAN);
  const [deletePlan] = useMutation(DELETE_PLAN);
  const [createItem] = useMutation(CREATE_ITEM);
  const [deleteItem] = useMutation(DELETE_ITEM);
  const [generate] = useMutation(GENERATE);

  const [planModal, setPlanModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [genModal, setGenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activePlanId, setActivePlanId] = useState(null);

  const plans = useMemo(() => data?.allFeePlans?.nodes || [], [data]);
  const classes = data?.allClasses?.nodes || [];
  const heads = data?.allFeeHeads?.nodes || [];
  const activePlan = plans.find((p) => p.id === activePlanId) || null;

  useEffect(() => {
    if (!activePlanId && plans.length) setActivePlanId(plans[0].id);
  }, [plans, activePlanId]);

  const planTotal = (plan) =>
    (plan.feePlanItemsByFeePlanId?.nodes || []).reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  const savePlan = async (form) => {
    try {
      if (editing) {
        await updatePlan({
          variables: {
            id: editing.id,
            patch: {
              name: form.name,
              description: form.description || null,
              classId: form.classId || null,
              isActive: form.isActive,
            },
          },
        });
        toast.success('Plan updated');
      } else {
        const institutionId = getInstitutionIdFromStorage();
        if (!institutionId) {
          toast.error('Missing institute context. Sign in again from your institute subdomain.');
          return;
        }
        await createPlan({
          variables: {
            plan: {
              institutionId,
              name: form.name,
              description: form.description || null,
              classId: form.classId || null,
              isActive: form.isActive,
            },
          },
        });
        toast.success('Plan created');
      }
      setPlanModal(false);
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const removePlan = async (plan) => {
    if (!confirm(`Delete "${plan.name}" and all of its line items?`)) return;
    try {
      await deletePlan({ variables: { id: plan.id } });
      toast.success('Plan deleted');
      setActivePlanId(null);
      refetch();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const addItem = async (form) => {
    try {
      await createItem({
        variables: {
          item: {
            feePlanId: activePlanId,
            feeHeadId: form.feeHeadId,
            amount: form.amount,
            frequency: form.frequency,
            dueDay: form.dueDay ? parseInt(form.dueDay, 10) : null,
            isOptional: form.isOptional,
          },
        },
      });
      toast.success('Fee head added to plan');
      setItemModal(false);
      refetch();
    } catch (err) {
      toast.error(
        err.message.includes('duplicate')
          ? 'That fee head is already on this plan at the same frequency.'
          : 'Error: ' + err.message
      );
    }
  };

  const removeItem = async (item) => {
    try {
      await deleteItem({ variables: { id: item.id } });
      toast.success('Removed from plan');
      refetch();
    } catch (err) {
      toast.error('Failed to remove: ' + err.message);
    }
  };

  const runGenerate = async (form) => {
    try {
      const res = await generate({
        variables: {
          planId: activePlanId,
          period: form.period,
          dueDate: form.dueDate,
          frequency: form.frequency || null,
        },
      });
      const r = res.data?.generateInvoicesForPlan?.results?.[0];
      if (!r) {
        toast.error('No result returned');
        return;
      }
      if (r.invoicesCreated === 0) {
        toast(`No new invoices — ${r.studentsSkipped} student(s) already billed for ${form.period}.`);
      } else {
        toast.success(
          `${r.invoicesCreated} invoice(s), ${r.linesCreated} line(s), ${formatInrPrecise(r.totalBilled)} billed.`
        );
      }
      setGenModal(false);
      refetch();
    } catch (err) {
      toast.error('Generation failed: ' + err.message);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Fee Plans</h1>
          <p className="text-zinc-500">Build a class-wise price list, then raise invoices from it in one click.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setPlanModal(true); }}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-all hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Plan
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">Loading fee plans...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-lg font-medium text-zinc-900">No fee plans yet</p>
          <p className="mt-1 text-sm text-zinc-500">Create a plan to define what each class is charged.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlanId(p.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  p.id === activePlanId
                    ? 'border-primary-500 bg-primary-50/60 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-900">{p.name}</span>
                  {!p.isActive && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Inactive</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {p.classByClassId?.name || 'All classes'} · {p.feePlanItemsByFeePlanId?.nodes?.length || 0} head(s)
                </p>
                <p className="mt-2 text-sm font-semibold text-primary-700">{formatInrPrecise(planTotal(p))}</p>
              </button>
            ))}
          </div>

          {activePlan && (
            <motion.div
              key={activePlan.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="flex flex-col gap-3 border-b border-zinc-100 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{activePlan.name}</h2>
                  <p className="text-sm text-zinc-500">
                    {activePlan.classByClassId?.name || 'All classes'}
                    {activePlan.description ? ` · ${activePlan.description}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setEditing(activePlan); setPlanModal(true); }} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => setItemModal(true)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                    <Plus className="h-3.5 w-3.5" /> Add Head
                  </button>
                  <button
                    onClick={() => setGenModal(true)}
                    disabled={!activePlan.feePlanItemsByFeePlanId?.nodes?.length}
                    className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
                  >
                    <Play className="h-3.5 w-3.5" /> Generate Invoices
                  </button>
                  <button onClick={() => removePlan(activePlan)} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50/50">
                    <tr>
                      {['Fee Head', 'Frequency', 'Due Day', 'Amount', ''].map((h) => (
                        <th key={h} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(activePlan.feePlanItemsByFeePlanId?.nodes || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-zinc-500">
                          No fee heads on this plan yet. Add one to start billing.
                        </td>
                      </tr>
                    ) : (
                      activePlan.feePlanItemsByFeePlanId.nodes.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50/80">
                          <td className="px-6 py-4">
                            <span className="font-medium text-zinc-900">{item.feeHeadByFeeHeadId?.name}</span>
                            {item.isOptional && (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Optional</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-600">{freqLabel(item.frequency)}</td>
                          <td className="px-6 py-4 text-sm text-zinc-600">{item.dueDay || '-'}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-zinc-900">{formatInrPrecise(item.amount)}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => removeItem(item)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
                <span className="text-sm text-zinc-500">Plan total per cycle</span>
                <span className="text-lg font-bold text-zinc-900">{formatInrPrecise(planTotal(activePlan))}</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <PlanModal isOpen={planModal} onClose={() => { setPlanModal(false); setEditing(null); }} onSubmit={savePlan} plan={editing} classes={classes} />
      <ItemModal isOpen={itemModal} onClose={() => setItemModal(false)} onSubmit={addItem} heads={heads} />
      <GenerateModal isOpen={genModal} onClose={() => setGenModal(false)} onSubmit={runGenerate} plan={activePlan} />
    </div>
  );
}

export default function FeePlansPage() {
  return (
    <ApolloWrapper>
      <FeePlansContent />
    </ApolloWrapper>
  );
}
