"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { BookMarked, Plus, Loader2, Search, X, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const EMPTY_BOOK = { title: "", author: "", isbn: "", category: "", publisher: "", location: "", total_copies: 1 };

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function LibraryPage() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState({});
  const [overdue, setOverdue] = useState([]);
  const [loans, setLoans] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_BOOK);
  const [submitting, setSubmitting] = useState(false);
  const [issueFor, setIssueFor] = useState(null);
  const [issue, setIssue] = useState({ borrower_id: "", due_date: defaultDueDate() });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const [bookData, statsData] = await Promise.all([
        apiFetch(`/api/library?${params}`),
        apiFetch("/api/library/stats"),
      ]);
      setBooks(bookData.books || []);
      setStats(statsData.stats || {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchLoans = useCallback(async () => {
    try {
      const data = await apiFetch("/api/library/transactions?status=issued");
      setLoans(data.transactions || []);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  const fetchOverdue = useCallback(async () => {
    try {
      const data = await apiFetch("/api/library/overdue");
      setOverdue(data.overdue || []);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    if (tab === "overdue") fetchOverdue();
    if (tab === "issued") fetchLoans();
  }, [tab, fetchOverdue, fetchLoans]);

  // Borrower list is only needed once, when the issue form first opens.
  const openIssue = async (book) => {
    setIssueFor(book);
    setIssue({ borrower_id: "", due_date: defaultDueDate() });
    if (borrowers.length === 0) {
      try {
        const data = await apiFetch("/api/library/borrowers");
        setBorrowers(data.borrowers || []);
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/library", {
        method: "POST",
        body: { ...form, total_copies: Number(form.total_copies) || 1 },
      });
      toast.success("Book added");
      setShowAdd(false);
      setForm(EMPTY_BOOK);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitIssue = async (e) => {
    e.preventDefault();
    if (!issue.borrower_id) return toast.error("Pick a borrower");
    setSubmitting(true);
    try {
      await apiFetch("/api/library/issue", {
        method: "POST",
        body: { book_id: issueFor.id, borrower_id: issue.borrower_id, due_date: issue.due_date },
      });
      toast.success("Book issued");
      setIssueFor(null);
      fetchData();
      if (tab === "issued") fetchLoans();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const returnLoan = async (tx) => {
    try {
      const res = await apiFetch("/api/library/return", {
        method: "POST",
        body: { transaction_id: tx.id },
      });
      toast.success(
        res?.fine_amount > 0
          ? `Returned — ${res.days_late} day(s) late, fine ₹${res.fine_amount}`
          : "Book returned"
      );
      fetchData();
      fetchLoans();
      if (tab === "overdue") fetchOverdue();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls =
    "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const tabCls = (t) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      tab === t ? "bg-primary-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"
    }`;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <BookMarked className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Library</h1>
            <p className="text-sm text-zinc-500">Catalog, issue and return tracking with overdue fines.</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Add Book
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat value={stats.total_books || 0} label="Titles" tone="text-zinc-900" />
        <Stat value={stats.total_copies || 0} label="Copies" tone="text-zinc-900" />
        <Stat value={stats.issued || 0} label="Issued" tone="text-blue-600" />
        <Stat value={stats.available || 0} label="Available" tone="text-emerald-600" />
        <Stat value={stats.overdue || 0} label="Overdue" tone="text-red-600" />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setTab("catalog")} className={tabCls("catalog")}>
          Catalog
        </button>
        <button onClick={() => setTab("issued")} className={tabCls("issued")}>
          Issued
        </button>
        <button onClick={() => setTab("overdue")} className={tabCls("overdue")}>
          Overdue
        </button>
      </div>

      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Add Book</h2>
            <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Title">
              <input required value={form.title} onChange={set("title")} className={inputCls} />
            </Field>
            <Field label="Author">
              <input value={form.author} onChange={set("author")} className={inputCls} />
            </Field>
            <Field label="ISBN">
              <input value={form.isbn} onChange={set("isbn")} className={inputCls} />
            </Field>
            <Field label="Category">
              <input value={form.category} onChange={set("category")} className={inputCls} placeholder="e.g. Fiction" />
            </Field>
            <Field label="Publisher">
              <input value={form.publisher} onChange={set("publisher")} className={inputCls} />
            </Field>
            <Field label="Shelf location">
              <input value={form.location} onChange={set("location")} className={inputCls} placeholder="e.g. A-3" />
            </Field>
            <Field label="Copies">
              <input
                type="number"
                min="1"
                value={form.total_copies}
                onChange={set("total_copies")}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {issueFor && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Issue “{issueFor.title}”</h2>
            <button onClick={() => setIssueFor(null)} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={submitIssue} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Borrower">
                <select
                  required
                  value={issue.borrower_id}
                  onChange={(e) => setIssue((f) => ({ ...f, borrower_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select a student or teacher…</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name} — {b.role}
                      {b.class_name ? ` (${b.class_name}${b.roll_number ? ` #${b.roll_number}` : ""})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Due date">
              <input
                type="date"
                required
                value={issue.due_date}
                onChange={(e) => setIssue((f) => ({ ...f, due_date: e.target.value }))}
                className={inputCls}
              />
            </Field>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Issue book
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {tab === "catalog" && (
        <>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or author..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <Panel>
            {loading ? (
              <Loading />
            ) : books.length === 0 ? (
              <Empty>No books found.</Empty>
            ) : (
              <Table
                head={["Title", "Author", "ISBN", "Category", "Available", ""]}
                rows={books.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{b.title}</td>
                    <td className="px-4 py-3 text-zinc-600">{b.author || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{b.isbn || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{b.category || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {b.available_copies ?? "—"} / {b.total_copies ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openIssue(b)}
                        disabled={(b.available_copies ?? 0) <= 0}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Issue
                      </button>
                    </td>
                  </tr>
                ))}
              />
            )}
          </Panel>
        </>
      )}

      {tab === "issued" && (
        <Panel>
          {loans.length === 0 ? (
            <Empty>No books are currently issued.</Empty>
          ) : (
            <Table
              head={["Book", "Borrower", "Issued", "Due", "Status", ""]}
              rows={loans.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-800">{t.book_title}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {t.borrower_name} <span className="text-xs text-zinc-400">({t.borrower_role})</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(t.issued_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(t.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {t.days_overdue > 0 ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                        {t.days_overdue}d overdue
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        On time
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => returnLoan(t)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <Undo2 className="h-3 w-3" /> Return
                    </button>
                  </td>
                </tr>
              ))}
            />
          )}
        </Panel>
      )}

      {tab === "overdue" && (
        <Panel>
          {overdue.length === 0 ? (
            <Empty>No overdue items.</Empty>
          ) : (
            <Table
              head={["Book", "Borrower", "Due Date", "Days Overdue", "Accrued Fine", ""]}
              rows={overdue.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-800">{o.book_title || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{o.borrower_name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600">{o.days_overdue ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">₹{Number(o.accrued_fine || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => returnLoan(o)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <Undo2 className="h-3 w-3" /> Return
                    </button>
                  </td>
                </tr>
              ))}
            />
          )}
        </Panel>
      )}
    </div>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

function Panel({ children }) {
  return <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">{children}</div>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading...
    </div>
  );
}

function Empty({ children }) {
  return <div className="py-16 text-center text-sm text-zinc-400">{children}</div>;
}

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{rows}</tbody>
      </table>
    </div>
  );
}
