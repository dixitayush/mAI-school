"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import Modal from '@/components/Modal';
import { toast } from 'react-hot-toast';
import { KeyRound, Loader2, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';

const GET_STAFF = gql`
  query GetStaff {
    allUsers(orderBy: FULL_NAME_ASC) {
      nodes {
        id
        username
        fullName
        role
        loginEnabled
        createdAt
        profileByUserId {
          email
          phone
        }
      }
    }
  }
`;

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
  mai_admin: 'bg-zinc-200 text-zinc-700',
};

const ROLE_LABEL = {
  admin: 'Admin',
  principal: 'Principal',
  opsadmin: 'Ops Admin',
  teacher: 'Teacher',
  student: 'Student',
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
    <Modal isOpen={Boolean(user)} onClose={onClose} title={`Reset password — ${user?.fullName || ''}`}>
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
          <p className="mt-1 text-xs text-zinc-500">Share it with {user?.fullName} over a private channel.</p>
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

function StaffContent() {
  const { loading, data, refetch } = useQuery(GET_STAFF);
  const [createStaff] = useMutation(CREATE_STAFF);
  const [setPassword] = useMutation(SET_PASSWORD);
  const [setEnabled] = useMutation(SET_ENABLED);

  const [modalOpen, setModalOpen] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [roleFilter, setRoleFilter] = useState('staff');

  const users = data?.allUsers?.nodes || [];

  const visible = useMemo(() => {
    if (roleFilter === 'staff') return users.filter((u) => u.role !== 'student' && u.role !== 'mai_admin');
    if (roleFilter === 'all') return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

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
    const next = !user.loginEnabled;
    if (!next && !confirm(`Disable sign-in for ${user.fullName}?`)) return;
    try {
      await setEnabled({ variables: { id: user.id, enabled: next } });
      toast.success(next ? 'Sign-in enabled' : 'Sign-in disabled');
      refetch();
    } catch (err) {
      toast.error(err.message.replace(/^.*?:\s*/, ''));
    }
  };

  const filters = [
    ['staff', 'Staff'],
    ['admin', 'Admins'],
    ['principal', 'Principals'],
    ['opsadmin', 'Ops Admins'],
    ['teacher', 'Teachers'],
    ['student', 'Students'],
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

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setRoleFilter(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              roleFilter === v ? 'bg-primary-600 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {l}
          </button>
        ))}
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
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">No accounts in this view.</td>
                </tr>
              )}
              {visible.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/60">
                  <td className="px-6 py-3 font-medium text-zinc-900">{u.fullName}</td>
                  <td className="px-6 py-3 text-zinc-600">{u.username}</td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[u.role] || 'bg-zinc-100 text-zinc-600'}`}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-zinc-600">{u.profileByUserId?.email || '—'}</td>
                  <td className="px-6 py-3">
                    {u.loginEnabled ? (
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
                        title={u.loginEnabled ? 'Disable sign-in' : 'Enable sign-in'}
                        className={`rounded-lg p-2 ${u.loginEnabled ? 'text-zinc-500 hover:bg-red-50 hover:text-red-600' : 'text-green-600 hover:bg-green-50'}`}
                      >
                        {u.loginEnabled ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
