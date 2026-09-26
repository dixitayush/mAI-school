"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { BookMarked, Plus, Loader2, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function LibraryPage() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState({});
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "", total_copies: 1 });
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchOverdue = async () => {
    try {
      const data = await apiFetch("/api/library/overdue");
      setOverdue(data.overdue || []);
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => { if (tab === "overdue") fetchOverdue(); }, [tab]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/library", { method: "POST", body: form });
      toast.success("Book added");
      setShowAdd(false);
      setForm({ title: "", author: "", isbn: "", category: "", total_copies: 1 });
      fetchData();
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const issueBook = async (bookId) => {
    const userId = prompt("Enter user ID to issue to:");
    if (!userId) return;
    try {
      await apiFetch("/api/library/issue", { method: "POST", body: { book_id: bookId, user_id: userId } });
      toast.success("Book issued");
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const returnBook = async (bookId) => {
    const userId = prompt("Enter user ID returning the book:");
    if (!userId) return;
    try {
      await apiFetch("/api/library/return", { method: "POST", body: { book_id: bookId, user_id: userId } });
      toast.success("Book returned");
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputCls = "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const tabCls = (t) => `rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-primary-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><BookMarked className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Library</h1><p className="text-sm text-zinc-500">Manage books, issue and return tracking.</p></div>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add Book
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-zinc-900">{stats.total_books || 0}</p><p className="text-xs font-medium text-zinc-500">Total Books</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-blue-600">{stats.issued || 0}</p><p className="text-xs font-medium text-zinc-500">Issued</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-emerald-600">{stats.available || 0}</p><p className="text-xs font-medium text-zinc-500">Available</p></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm"><p className="text-2xl font-bold text-red-600">{stats.overdue || 0}</p><p className="text-xs font-medium text-zinc-500">Overdue</p></div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setTab("catalog")} className={tabCls("catalog")}>Catalog</button>
        <button onClick={() => setTab("overdue")} className={tabCls("overdue")}>Overdue</button>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-zinc-900">Add Book</h2><button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button></div>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Title</label><input required value={form.title} onChange={set("title")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Author</label><input value={form.author} onChange={set("author")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">ISBN</label><input value={form.isbn} onChange={set("isbn")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Category</label><input value={form.category} onChange={set("category")} className={inputCls} /></div>
            <div><label className="mb-1 block text-sm font-medium text-zinc-700">Copies</label><input type="number" min="1" value={form.total_copies} onChange={(e) => setForm((f) => ({ ...f, total_copies: Number(e.target.value) }))} className={inputCls} /></div>
            <div className="flex items-end"><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add</button></div>
          </form>
        </motion.div>
      )}

      {tab === "catalog" && (
        <>
          <div className="mb-4 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books..."
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
            ) : books.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400">No books found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Title</th><th className="px-4 py-3">Author</th><th className="px-4 py-3">ISBN</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-zinc-100">
                    {books.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-zinc-800">{b.title}</td>
                        <td className="px-4 py-3 text-zinc-600">{b.author || "—"}</td>
                        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{b.isbn || "—"}</td>
                        <td className="px-4 py-3 text-zinc-600">{b.available_copies ?? "—"} / {b.total_copies ?? "—"}</td>
                        <td className="px-4 py-3 flex gap-1">
                          <button onClick={() => issueBook(b.id)} className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Issue</button>
                          <button onClick={() => returnBook(b.id)} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Return</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "overdue" && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {overdue.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">No overdue items.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Book</th><th className="px-4 py-3">Borrower</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Days Overdue</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {overdue.map((o, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-800">{o.book_title || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{o.borrower_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{o.days_overdue || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
