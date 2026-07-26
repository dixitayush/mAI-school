"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import { toast } from 'react-hot-toast';
import { getInstitutionIdFromStorage } from '@/lib/tenant';

const GET_HEADS = gql`
  query GetFeeHeads {
    allFeeHeads(orderBy: SORT_ORDER_ASC) {
      nodes {
        id
        name
        code
        description
        isRecurring
        defaultFrequency
        isActive
        sortOrder
      }
    }
  }
`;

const CREATE_HEAD = gql`
  mutation CreateFeeHead($head: FeeHeadInput!) {
    createFeeHead(input: { feeHead: $head }) {
      feeHead {
        id
      }
    }
  }
`;

const UPDATE_HEAD = gql`
  mutation UpdateFeeHead($id: UUID!, $patch: FeeHeadPatch!) {
    updateFeeHeadById(input: { id: $id, feeHeadPatch: $patch }) {
      feeHead {
        id
      }
    }
  }
`;

const DELETE_HEAD = gql`
  mutation DeleteFeeHead($id: UUID!) {
    deleteFeeHeadById(input: { id: $id }) {
      deletedFeeHeadId
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

const EMPTY = {
  name: '',
  code: '',
  description: '',
  defaultFrequency: 'one_time',
  isRecurring: false,
  isActive: true,
  sortOrder: 100,
};

function HeadModal({ isOpen, onClose, onSubmit, head }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(head ? { ...EMPTY, ...head } : EMPTY);
  }, [isOpen, head]);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={head ? 'Edit Fee Head' : 'New Fee Head'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Name *</label>
            <input name="name" value={form.name} onChange={change} required className={field} placeholder="Bus Fee" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Code *</label>
            <input
              name="code"
              value={form.code}
              onChange={change}
              required
              disabled={Boolean(head)}
              className={`${field} disabled:bg-zinc-100 disabled:text-zinc-500`}
              placeholder="BUS"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
          <input name="description" value={form.description || ''} onChange={change} className={field} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Default frequency</label>
            <select name="defaultFrequency" value={form.defaultFrequency} onChange={change} className={`${field} bg-white`}>
              {FREQUENCIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Sort order</label>
            <input type="number" name="sortOrder" value={form.sortOrder} onChange={change} className={field} />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="isRecurring" checked={form.isRecurring} onChange={change} className="rounded" />
            Recurring charge
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} className="rounded" />
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : head ? 'Save Changes' : 'Create Head'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FeeHeadsContent() {
  const { loading, data, refetch } = useQuery(GET_HEADS);
  const [createHead] = useMutation(CREATE_HEAD);
  const [updateHead] = useMutation(UPDATE_HEAD);
  const [deleteHead] = useMutation(DELETE_HEAD);

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const columns = [
    { header: 'Code', accessor: 'code' },
    { header: 'Fee Head', accessor: 'name' },
    { header: 'Description', accessor: 'description', render: (r) => r.description || '-' },
    {
      header: 'Frequency',
      accessor: 'defaultFrequency',
      render: (r) => FREQUENCIES.find(([v]) => v === r.defaultFrequency)?.[1] || r.defaultFrequency,
    },
    {
      header: 'Recurring',
      accessor: 'isRecurring',
      render: (r) => (r.isRecurring ? 'Yes' : 'No'),
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (r) => (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const handleSubmit = async (form) => {
    try {
      if (selected) {
        await updateHead({
          variables: {
            id: selected.id,
            patch: {
              name: form.name,
              description: form.description || null,
              defaultFrequency: form.defaultFrequency,
              isRecurring: form.isRecurring,
              isActive: form.isActive,
              sortOrder: parseInt(form.sortOrder, 10) || 0,
            },
          },
        });
        toast.success('Fee head updated');
      } else {
        const institutionId = getInstitutionIdFromStorage();
        if (!institutionId) {
          toast.error('Missing institute context. Sign in again from your institute subdomain.');
          return;
        }
        await createHead({
          variables: {
            head: {
              institutionId,
              name: form.name,
              code: form.code.trim().toUpperCase(),
              description: form.description || null,
              defaultFrequency: form.defaultFrequency,
              isRecurring: form.isRecurring,
              isActive: form.isActive,
              sortOrder: parseInt(form.sortOrder, 10) || 0,
            },
          },
        });
        toast.success('Fee head created');
      }
      setModalOpen(false);
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete "${row.name}"? Fee heads already used on an invoice cannot be removed.`)) return;
    try {
      await deleteHead({ variables: { id: row.id } });
      toast.success('Fee head deleted');
      refetch();
    } catch (err) {
      toast.error('Cannot delete: it is referenced by an existing fee plan or invoice.');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">Fee Heads</h1>
        <p className="text-zinc-500">
          The chargeable categories used to build fee plans — tuition, transport, exams and any custom head you need.
        </p>
      </div>

      <DataTable
        title="All Fee Heads"
        columns={columns}
        data={data?.allFeeHeads?.nodes || []}
        isLoading={loading}
        onAdd={() => { setSelected(null); setModalOpen(true); }}
        onEdit={(row) => { setSelected(row); setModalOpen(true); }}
        onDelete={handleDelete}
      />

      <HeadModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onSubmit={handleSubmit}
        head={selected}
      />
    </div>
  );
}

export default function FeeHeadsPage() {
  return (
    <ApolloWrapper>
      <FeeHeadsContent />
    </ApolloWrapper>
  );
}
