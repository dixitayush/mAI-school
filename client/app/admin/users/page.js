"use client";

import { useCallback, useEffect, useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import StudentId from '@/components/StudentId';
import { apiFetch } from '@/lib/api';
import { toQuery } from '@/lib/useFilterOptions';
import { toast } from 'react-hot-toast';
import { KeyRound, Loader2, Plus, Search, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';

const CREATE_STAFF = gql`
  mutation RegisterStaffUser(
    $username: String!
    $password: String!
    $role: String!
    $fullName: String!
    $email: String
    $subject: String
    $qualification: String
  ) {
    registerStaffUser(
      input: {
        pUsername: $username
        pPassword: $password
        pRole: $role
        pFullName: $fullName
        pEmail: $email
        pSubjectSpecialization: $subject
        pQualification: $qualification
      }
    ) {
      user {
        id
        username
        role
      }
    }
  }
`;

const SET_PASSWORD = gql`
  mutation SetUserPassword($id: UUID!, $password: String!) {
    setUserPassword(input: { pUserId: $id, pPassword: $password }) {
      ids
    }
  }
`;

const SET_ENABLED = gql`
  mutation SetUserLoginEnabled($id: UUID!, $enabled: Boolean!) {
    setUserLoginEnabled(input: { pUserId: $id, pEnabled: $enabled }) {
      results {
        id
        loginEnabled
      }
    }
  }
`;

const STAFF_ROLES = [
  ['admin', 'Admin', 'Full access to the school, including approvals.'],
  ['principal', 'Principal', 'Academic oversight plus finance visibility.'],
  ['opsadmin', 'Ops Admin', 'Fees, payroll and expenses. Cannot approve spending.'],
  ['teacher', 'Teacher', 'Classes, attendance, assignments and exams.'],
];

const ROLE_BADGE = {
  admin: 'bg-primary-100 text-primary-700',
  principal: 'bg-amber-100 text-amber-700',
  opsadmin: 'bg-cyan-100 text-cyan-700',
  teacher: 'bg-violet-100 text-violet-700',
  student: 'bg-emerald-100 text-emerald-700',
  parent: 'bg-rose-100 text-rose-700',
  mai_admin: 'bg-zinc-200 text-zinc-700',
};

const ROLE_LABEL = {
  admin: 'Admin',
  principal: 'Principal',
  opsadmin: 'Ops Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  mai_admin: 'Platform Admin',
};

const field =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary-500';

const EMPTY = {
  fullName: '',
  username: '',
  password: '',
  role: 'opsadmin',
  email: '',
  subject: '',
  qualification: '',
};

function StaffModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(EMPTY);
  }, [isOpen]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  const roleInfo = STAFF_ROLES.find(([v]) => v === form.role);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Staff Account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Role *</label>
          <select name="role" value={form.role} onChange={change} className={`${field} bg-white`}>
            {STAFF_ROLES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {roleInfo && <p className="mt-1 text-xs text-zinc-500">{roleInfo[2]}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Full name *</label>
          <input name="fullName" value={form.fullName} onChange={change} required className={field} placeholder="Priya Nair" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Username *</label>
            <input name="username" value={form.username} onChange={change} required className={field} placeholder="priya.nair" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Password *</label>
            <input type="password" name="password" value={form.password} onChange={change} required minLength={8} className={field} placeholder="At least 8 characters" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
          <input type="email" name="email" value={form.email} onChange={change} className={field} />
        </div>

        {form.role === 'teacher' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Subject</label>
              <input name="subject" value={form.subject} onChange={change} className={field} placeholder="Mathematics" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Qualification</label>
              <input name="qualification" value={form.qualification} onChange={change} className={field} placeholder="M.Sc." />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  useEffect(() => setPassword(''), [user]);

  return (
    <Modal isOpen={Boolean(user)} onClose={onClose} title={`Reset password — ${user?.full_name || ''}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(password);
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">New password *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={field} placeholder="At least 8 characters" />
          <p className="mt-1 text-xs text-zinc-500">Share it with {user?.full_name} over a private channel.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 hover:bg-zinc-50">
            Cancel
          </button>
          <button type="submit" className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
            Reset Password
          </button>
        </div>
      </form>
    </Modal>
  );
}

const DEFAULT_FILTERS = { role: 'staff', status: '', search: '', sort: 'name', page: 1, limit: 25 };

const SORT_OPTIONS = [
  ['name', 'Name A–Z'],
  ['name_desc', 'Name Z–A'],
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['role', 'Role'],
];

function StaffContent() {
  const [createStaff] = useMutation(CREATE_STAFF);
  const [setPassword] = useMutation(SET_PASSWORD);
  const [setEnabled] = useMutation(SET_ENABLED);

  const [modalOpen, setModalOpen] = useState(false);
  const [resetting, setResetting] = useState(null);
  // Paged and filtered server side: with every student and parent account
  // this list runs into thousands of rows.
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [result, setResult] = useState({ users: [], total: 0, total_pages: 1, page: 1, counts: {} });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/users${toQuery(filters)}`);
      setResult({
        users: d.users || [],
        total: d.total || 0,
        total_pages: d.total_pages || 1,
        page: d.page || 1,
        counts: d.counts || {},
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  const refetch = load;
  const visible = result.users;
  // Any filter change returns to page 1; only the pager moves pages.
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const filtersActive = filters.search || filters.status || filters.sort !== 'name';

  const create = async (form) => {
    try {
      await createStaff({
        variables: {
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          fullName: form.fullName.trim(),
          email: form.email || null,
          subject: form.role === 'teacher' ? form.subject || null : null,
          qualification: form.role === 'teacher' ? form.qualification || null : null,
        },
      });
      toast.success(`${ROLE_LABEL[form.role]} account created`);
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message.replace(/^.*?:\s*/, ''));
    }
  };

  const reset = async (password) => {
    try {
      await setPassword({ variables: { id: resetting.id, password } });
      toast.success('Password reset');
      setResetting(null);
    } catch (err) {
      toast.error(err.message.replace(/^.*?:\s*/, ''));
    }
  };

  const toggle = async (user) => {
    const next = !user.login_enabled;
    if (!next && !confirm(`Disable sign-in for ${user.full_name}?`)) return;
    try {
      await setEnabled({ variables: { id: user.id, enabled: next } });
      toast.success(next ? 'Sign-in enabled' : 'Sign-in disabled');
      refetch();
    } catch (err) {
      toast.error(err.message.replace(/^.*?:\s*/, ''));
    }
  };

  const roleChips = [
    ['staff', 'Staff'],
    ['admin', 'Admins'],
    ['principal', 'Principals'],
    ['opsadmin', 'Ops Admins'],
    ['teacher', 'Teachers'],
    ['student', 'Students'],
    ['parent', 'Parents'],
    ['all', 'Everyone'],
  ];

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">Staff Accounts</h1>
          <p className="text-zinc-500">
            Create admin, principal, ops admin and teacher logins, reset passwords and disable access.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Staff Account
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {roleChips.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter('role', v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filters.role === v ? 'bg-primary-600 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {l}
            {result.counts[v] !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${filters.role === v ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}>
                {result.counts[v]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search name, username, email, phone or registration ID…"
            className="w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            aria-label="Sign-in status"
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Any sign-in status</option>
            <option value="enabled">Sign-in enabled</option>
            <option value="disabled">Sign-in disabled</option>
          </select>
          <select
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value)}
            aria-label="Sort by"
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {filtersActive && (
            <button
              onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, role: f.role, limit: f.limit }))}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Sign-in</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    {filters.search ? `No accounts match “${filters.search}”.` : 'No accounts in this view.'}
                  </td>
                </tr>
              )}
              {!loading && visible.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/60">
                  <td className="px-6 py-3">
                    <p className="font-medium text-zinc-900">{u.full_name}</p>
                    {u.role === 'student' && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <StudentId value={u.registration_id} />
                        {u.class_name && <span>{u.class_name}{u.section ? ` · ${u.section}` : ''}</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-zinc-600">{u.username}</td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[u.role] || 'bg-zinc-100 text-zinc-600'}`}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-zinc-600">
                    {u.email || '—'}
                    {u.phone && <p className="text-xs text-zinc-400">{u.phone}</p>}
                  </td>
                  <td className="px-6 py-3">
                    {u.login_enabled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <ShieldCheck className="h-3.5 w-3.5" /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <UserX className="h-3.5 w-3.5" /> Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setResetting(u)} title="Reset password" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggle(u)}
                        title={u.login_enabled ? 'Disable sign-in' : 'Enable sign-in'}
                        className={`rounded-lg p-2 ${u.login_enabled ? 'text-zinc-500 hover:bg-red-50 hover:text-red-600' : 'text-green-600 hover:bg-green-50'}`}
                      >
                        {u.login_enabled ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pagination
          page={result.page}
          totalPages={result.total_pages}
          total={result.total}
          limit={filters.limit}
          onPage={(p) => setFilters((f) => ({ ...f, page: p }))}
        />
        {result.total > 25 && (
          <label className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            Rows per page
            <select
              value={filters.limit}
              onChange={(e) => setFilter('limit', Number(e.target.value))}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
            >
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>

      <StaffModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={create} />
      <PasswordModal user={resetting} onClose={() => setResetting(null)} onSubmit={reset} />
    </div>
  );
}

export default function StaffPage() {
  return (
    <ApolloWrapper>
      <StaffContent />
    </ApolloWrapper>
  );
}
