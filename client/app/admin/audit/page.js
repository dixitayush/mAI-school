"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Shield, Search, Loader2, Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toQuery } from "@/lib/useFilterOptions";
import Pagination from "@/components/Pagination";
import Uuid from "@/components/Uuid";
import StudentId from "@/components/StudentId";

/** Matches the audit_log.severity CHECK constraint. */
const SEVERITY_COLORS = {
  info: "bg-zinc-100 text-zinc-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const ROLE_LABEL = {
  admin: "Admin",
  principal: "Principal",
  opsadmin: "Ops Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  mai_admin: "Platform Admin",
};

const EMPTY_FILTERS = {
  q: "", action: "", entity_type: "", severity: "", actor_id: "", actor_role: "",
  from: "", to: "", sort: "newest",
};

const ctl =
  "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

const humanize = (s) => String(s || "").replace(/[_.]/g, " ");

/** yyyy-mm-dd for `days` ago in local time, matching what a date input holds. */
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_PRESETS = [
  ["Today", 0],
  ["7 days", 6],
  ["30 days", 29],
  ["90 days", 89],
];

/** Actions grouped by their prefix ("import.upload" → "import") for the dropdown. */
function groupActions(actions) {
  const groups = {};
  for (const a of actions) {
    const key = a.includes(".") ? a.split(".")[0] : "other";
    (groups[key] ||= []).push(a);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState({ actions: [], entity_types: [], actors: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [expanded, setExpanded] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/audit${toQuery({ ...filters, q: filters.q.trim(), page, limit })}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    apiFetch("/api/audit/filters")
      .then((d) => setOptions({ actions: d.actions || [], entity_types: d.entity_types || [], actors: d.actors || [] }))
      .catch(() => {});
  }, []);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchLogs, filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLogs, filters.q]);

  // Any filter change returns to page 1; only the pager moves pages.
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setExpanded(null);
  };

  const activeCount = Object.entries(filters).filter(([k, v]) => v && v !== EMPTY_FILTERS[k]).length;
  const presetActive = (days) => filters.from === daysAgo(days) && !filters.to;
  const actorRoles = [...new Set(options.actors.map((a) => a.role))].sort();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Audit Log</h1>
          <p className="text-sm text-zinc-500">Track all system activity and changes.</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilter({ q: e.target.value })}
              className={`${ctl} w-full pl-9`}
              placeholder="Search action, person, IP, details, registration ID or a pasted ID…"
            />
          </div>
          <select value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })} className={ctl} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-600">
            <Filter className="h-4 w-4" /> Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-primary-600 px-1.5 text-xs text-white">{activeCount}</span>
            )}
          </span>
          <select value={filters.action} onChange={(e) => setFilter({ action: e.target.value })} className={ctl} aria-label="Action">
            <option value="">All actions</option>
            {groupActions(options.actions).map(([group, items]) => (
              <optgroup key={group} label={humanize(group)}>
                {items.map((a) => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={filters.entity_type} onChange={(e) => setFilter({ entity_type: e.target.value })} className={ctl} aria-label="Entity type">
            <option value="">All records</option>
            {options.entity_types.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
          <select value={filters.actor_id} onChange={(e) => setFilter({ actor_id: e.target.value })} className={ctl} aria-label="Performed by">
            <option value="">Anyone</option>
            {options.actors.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name} ({ROLE_LABEL[a.role] || a.role}) · {a.events}</option>
            ))}
          </select>
          <select value={filters.actor_role} onChange={(e) => setFilter({ actor_role: e.target.value })} className={ctl} aria-label="Actor role">
            <option value="">Any role</option>
            {actorRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
          </select>
          <select value={filters.severity} onChange={(e) => setFilter({ severity: e.target.value })} className={ctl} aria-label="Severity">
            <option value="">All severity</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map(([label, days]) => (
            <button
              key={label}
              onClick={() => setFilter({ from: daysAgo(days), to: "" })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                presetActive(days) ? "bg-primary-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-zinc-400">or</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter({ from: e.target.value })} className={`${ctl} py-1.5`} aria-label="From date" />
          <span className="text-xs text-zinc-400">to</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter({ to: e.target.value })} className={`${ctl} py-1.5`} aria-label="To date" />
          {activeCount > 0 && (
            <button
              onClick={() => setFilter(EMPTY_FILTERS)}
              className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" /> Clear all
            </button>
          )}
        </div>
      </motion.div>

      <div className="mb-2 text-xs text-zinc-500">
        {loading ? "Loading…" : `${total.toLocaleString()} event${total === 1 ? "" : "s"}`}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            {activeCount > 0 ? "No audit events match these filters." : "No audit logs found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => {
                  const open = expanded === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr onClick={() => setExpanded(open ? null : log.id)} className="cursor-pointer transition-colors hover:bg-zinc-50">
                        <td className="px-2 py-3 text-zinc-400">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setFilter({ action: log.action }); }}
                            title="Show only this action"
                            className="font-medium text-zinc-800 hover:text-primary-700 hover:underline"
                          >
                            {log.action}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {log.actor_id ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setFilter({ actor_id: log.actor_id }); }}
                              title="Show only this person's activity"
                              className="text-left hover:text-primary-700 hover:underline"
                            >
                              {log.actor_name || "Unknown user"}
                              {log.actor_role && (
                                <span className="block text-xs text-zinc-400">{ROLE_LABEL[log.actor_role] || log.actor_role}</span>
                              )}
                            </button>
                          ) : (
                            <span className="text-zinc-400">System</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          <span className="capitalize">{humanize(log.entity_type) || "—"}</span>
                          {log.entity_registration_id && (
                            <span className="ml-1.5"><StudentId value={log.entity_registration_id} plain className="text-xs font-semibold text-indigo-600" /></span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.info}`}>
                            {log.severity || "info"}
                          </span>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-zinc-50/70">
                          <td />
                          <td colSpan={5} className="px-4 pb-4 pt-1">
                            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                              <div><dt className="text-zinc-400">Record ID</dt><dd>{log.entity_id ? <Uuid value={log.entity_id} label="Record ID" /> : "—"}</dd></div>
                              <div><dt className="text-zinc-400">Actor</dt><dd className="text-zinc-700">{log.actor_name ? `${log.actor_name} (${log.actor_username})` : "System"}</dd></div>
                              <div><dt className="text-zinc-400">IP address</dt><dd className="font-mono text-zinc-700">{log.ip_address || "—"}</dd></div>
                              <div><dt className="text-zinc-400">Device</dt><dd className="truncate text-zinc-700" title={log.user_agent || ""}>{log.user_agent || "—"}</dd></div>
                            </dl>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-white p-3 text-xs text-zinc-700 ring-1 ring-zinc-200">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPage={(p) => { setPage(p); setExpanded(null); }}
        />
        {total > 25 && (
          <label className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            Rows per page
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
            >
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
