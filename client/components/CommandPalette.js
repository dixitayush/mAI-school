"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X, Command } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { flattenSearchResults } from "@/lib/search";
import { useTenantPaths } from "@/lib/useTenantPaths";

const ACTIONS = [
  { id: "dash", label: "Go to Dashboard", section: "Navigation", href: "/" },
  { id: "students", label: "Manage Students", section: "Navigation", href: "/admin/users/students" },
  { id: "teachers", label: "Manage Teachers", section: "Navigation", href: "/admin/users/teachers" },
  { id: "classes", label: "Manage Classes", section: "Navigation", href: "/admin/classes" },
  { id: "attendance", label: "Attendance", section: "Navigation", href: "/admin/attendance" },
  { id: "fees", label: "Fee Management", section: "Navigation", href: "/admin/fees" },
  { id: "exams", label: "Exams & Results", section: "Navigation", href: "/exams" },
  { id: "announcements", label: "Announcements", section: "Navigation", href: "/admin/announcements" },
  { id: "timetable", label: "Timetable", section: "Navigation", href: "/admin/timetable" },
  { id: "settings", label: "Settings", section: "Navigation", href: "/admin/settings" },
  { id: "branding", label: "Branding & Theme", section: "Navigation", href: "/admin/branding" },
  { id: "audit", label: "Audit Log", section: "Navigation", href: "/admin/audit" },
  { id: "security", label: "Security Center", section: "Navigation", href: "/admin/security" },
  { id: "setup", label: "School Setup", section: "Navigation", href: "/admin/setup" },
  { id: "imports", label: "Import / Export", section: "Navigation", href: "/admin/imports" },
  { id: "helpdesk", label: "Helpdesk", section: "Navigation", href: "/admin/helpdesk" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();
  const { to } = useTenantPaths();
  const timer = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(ACTIONS.slice(0, 8));
      setSearchResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
      const flat = flattenSearchResults(data);
      setSearchResults(flat.slice(0, 5));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const q = query.toLowerCase().trim();
    const filtered = q ? ACTIONS.filter((a) => a.label.toLowerCase().includes(q)) : ACTIONS.slice(0, 8);
    setResults(filtered);
    setSelectedIndex(0);
    clearTimeout(timer.current);
    if (q.length >= 2) timer.current = setTimeout(() => doSearch(q), 300);
    else setSearchResults([]);
  }, [query, doSearch]);

  const allItems = [...results, ...searchResults.map((r) => ({
    id: `sr-${r.id}`,
    label: r.name || r.title || r.full_name || "—",
    hint: r.subtitle,
    section: r._type,
    searchResult: r,
    href: r._type === "students" && r.registration_id
      ? `/admin/users/students?search=${encodeURIComponent(r.registration_id)}`
      : undefined,
  }))];

  const select = (item) => {
    setOpen(false);
    if (item.href) router.push(to(item.href));
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allItems[selectedIndex]) { e.preventDefault(); select(allItems[selectedIndex]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-zinc-400" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search or jump to..." className="h-8 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400" />
          {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />}
          <kbd className="hidden shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline">ESC</kbd>
        </div>

        <div className="max-h-72 overflow-y-auto py-2">
          {allItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">No results found</div>
          ) : (
            allItems.map((item, i) => (
              <button key={item.id} onClick={() => select(item)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${i === selectedIndex ? "bg-primary-50 text-primary-800" : "text-zinc-700 hover:bg-zinc-50"}`}>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">{item.section}</span>
                <span className="truncate font-medium">{item.label}</span>
                {item.hint && <span className="ml-auto truncate font-mono text-xs text-zinc-400">{item.hint}</span>}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-zinc-100 px-4 py-2 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1"><Command className="h-3 w-3" />K to toggle</span>
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
        </div>
      </div>
    </div>
  );
}
