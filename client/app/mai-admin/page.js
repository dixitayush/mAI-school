"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Building2, Copy, Loader2, Plus, Shield, Users } from "lucide-react";
import { motion } from "framer-motion";
import { instituteLoginPageUrl } from "@/lib/tenant";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function MaiAdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    adminUsername: "",
    adminPassword: "",
    adminFullName: "",
  });
  const [expandedId, setExpandedId] = useState(null);
  const [instUsers, setInstUsers] = useState({});

  const loadStats = useCallback(async () => {
    const t = localStorage.getItem("token");
    const res = await fetch(`${apiBase}/api/platform/stats`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error("Failed to load stats");
    const data = await res.json();
    setStats(data.institutions || []);
  }, []);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const t = localStorage.getItem("token");
    if (!t || role !== "mai_admin") {
      router.replace("/login");
      return;
    }
    setAuthorized(true);
    (async () => {
      try {
        await loadStats();
      } catch (e) {
        toast.error(e.message || "Could not load platform data");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadStats]);

  const loadUsers = async (institutionId) => {
    const t = localStorage.getItem("token");
    const res = await fetch(`${apiBase}/api/platform/institutions/${institutionId}/users`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error("Failed to load users");
    const data = await res.json();
    setInstUsers((prev) => ({ ...prev, [institutionId]: data.users || [] }));
  };

  const toggleInstitution = async (id, isActive) => {
    try {
      const t = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/api/platform/institutions/${id}/active`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(isActive ? "Institute enabled" : "Institute disabled");
      await loadStats();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const toggleUserLogin = async (userId, loginEnabled, institutionId) => {
    try {
      const t = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/api/platform/users/${userId}/login-enabled`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loginEnabled }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(loginEnabled ? "Login enabled" : "Login disabled");
      if (institutionId) await loadUsers(institutionId);
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  const copyInstituteLoginUrl = async (slug) => {
    const url = instituteLoginPageUrl(slug);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Login page URL copied");
    } catch {
      toast.error("Could not copy — copy the link manually");
    }
  };

  const createInstitution = async (e) => {
    e.preventDefault();
    try {
      const t = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/api/platform/institutions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          logoUrl: form.logoUrl || undefined,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
          adminFullName: form.adminFullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Institute onboarded");
      setForm({
        name: "",
        slug: "",
        logoUrl: "",
        adminUsername: "",
        adminPassword: "",
        adminFullName: "",
      });
      await loadStats();
    } catch (e) {
      toast.error(e.message || "Error");
    }
  };

  if (!authorized) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">MAI platform</h1>
        <p className="mt-2 text-zinc-600">
          Onboard institutes, control access, and review usage across tenants.
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="mb-6 flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary-600" aria-hidden />
          <h2 className="text-xl font-semibold text-zinc-900">Onboard institute</h2>
        </div>
        <form onSubmit={createInstitution} className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Institute name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Subdomain slug</span>
            <input
              required
              pattern="[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?"
              title="Lowercase letters, numbers, hyphens"
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().trim() }))
              }
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 font-mono text-sm"
              placeholder="e.g. greenfield-high"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Logo URL (optional)</span>
            <input
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              placeholder="https://…"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-zinc-700">
              First institute admin — full name
            </span>
            <input
              required
              value={form.adminFullName}
              onChange={(e) => setForm((f) => ({ ...f, adminFullName: e.target.value }))}
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Admin username</span>
            <input
              required
              value={form.adminUsername}
              onChange={(e) => setForm((f) => ({ ...f, adminUsername: e.target.value }))}
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 font-mono text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Admin password</span>
            <input
              required
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
              className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="h-11 rounded-full bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Create institute & admin
            </button>
          </div>
        </form>
      </motion.section>

      <section className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary-600" aria-hidden />
          <h2 className="text-xl font-semibold text-zinc-900">Institutes & usage</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : stats.length === 0 ? (
          <p className="text-zinc-500">No institutes yet.</p>
        ) : (
          <div className="space-y-3">
            {stats.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900">{row.name}</p>
                    <p className="font-mono text-sm text-zinc-500">{row.slug}</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <p className="min-w-0 break-all font-mono text-xs text-zinc-600 sm:text-sm">
                        {instituteLoginPageUrl(row.slug)}
                      </p>
                      <button
                        type="button"
                        onClick={() => copyInstituteLoginUrl(row.slug)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 sm:text-sm"
                      >
                        <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                        Copy login URL
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-4 w-4" aria-hidden />
                        {row.students} students
                      </span>
                      <span>{row.teachers} teachers</span>
                      <span>{row.admins} admins</span>
                      <span>{row.classes} classes</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(e) => toggleInstitution(row.id, e.target.checked)}
                      />
                      Institute active
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = expandedId === row.id ? null : row.id;
                        setExpandedId(next);
                        if (next) await loadUsers(row.id);
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      {expandedId === row.id ? "Hide logins" : "Manage logins"}
                    </button>
                  </div>
                </div>
                {expandedId === row.id && (
                  <ul className="mt-4 space-y-2 border-t border-zinc-200/80 pt-4">
                    {(instUsers[row.id] || []).map((u) => (
                      <li
                        key={u.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-zinc-400" aria-hidden />
                          <span className="font-mono">{u.username}</span>
                          <span className="text-zinc-500">({u.role})</span>
                        </span>
                        <label className="flex items-center gap-2 text-zinc-600">
                          <input
                            type="checkbox"
                            checked={u.loginEnabled}
                            onChange={(e) =>
                              toggleUserLogin(u.id, e.target.checked, row.id)
                            }
                          />
                          Login allowed
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
