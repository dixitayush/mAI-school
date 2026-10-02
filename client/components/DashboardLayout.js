"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { Menu as MenuIcon, Search, X, Loader2, ChevronDown, LogOut, UserRound, Command } from "lucide-react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import NotificationBell from "@/components/NotificationBell";
import CommandPalette from "@/components/CommandPalette";
import { AnimatePresence, motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import Sidebar from "@/components/Sidebar";
import NotificationListener from "@/components/NotificationListener";
import ChatWidget from "@/components/ChatWidget";
import { useTenantPaths } from "@/lib/useTenantPaths";
import { useSession } from "@/lib/useSession";
import { apiFetch } from "@/lib/api";
import { flattenSearchResults } from "@/lib/search";
import { useLogout } from "@/lib/useLogout";

const ROLE_META = {
  mai_admin: {
    searchPlaceholder: "Search institutions, users…",
    subtitle: "MAI platform",
    ring: "from-slate-600 to-zinc-800",
  },
  admin: {
    searchPlaceholder: "Search students, classes, records…",
    subtitle: "Administrator",
    ring: "from-primary-500 to-emerald-600",
  },
  teacher: {
    searchPlaceholder: "Search students, classes, attendance…",
    subtitle: "Educator",
    ring: "from-violet-500 to-primary-600",
  },
  principal: {
    searchPlaceholder: "Search students, classes, reports…",
    subtitle: "Principal",
    ring: "from-amber-500 to-primary-600",
  },
  opsadmin: {
    searchPlaceholder: "Search invoices, payroll, expenses…",
    subtitle: "Operations",
    ring: "from-cyan-500 to-blue-600",
  },
  parent: {
    searchPlaceholder: "Search announcements, events…",
    subtitle: "Parent",
    ring: "from-pink-500 to-rose-600",
  },
  student: {
    searchPlaceholder: "Search exams, results, fees…",
    subtitle: "Student",
    ring: "from-emerald-500 to-teal-600",
  },
};

const DISPLAY_FALLBACK = {
  mai_admin: "MAI Admin",
  admin: "Admin",
  teacher: "Teacher",
  principal: "Principal",
  opsadmin: "Ops Admin",
  parent: "Parent",
  student: "Student",
};

const RESULT_LINKS = {
  students: (r, to) => to(`/admin/users/students${r.registration_id ? `?search=${encodeURIComponent(r.registration_id)}` : ""}`),
  teachers: (r, to) => to(`/admin/users/teachers`),
  classes: (r, to) => to(`/admin/classes`),
  announcements: (r, to) => to(`/admin/announcements`),
  events: (r, to) => to(`/admin/holidays`),
};

/** CommandPalette listens for ⌘K / Ctrl+K on document; reuse that. */
function openCommandPalette() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function ProfileMenu({ displayName, meta, profileHref, role }) {
  const logout = useLogout(role);
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 transition data-[focus]:bg-zinc-100 data-[focus]:text-zinc-900";
  return (
    <Menu as="div" className="relative">
      <MenuButton className="group flex min-w-0 items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 outline-none transition hover:bg-zinc-100 data-[open]:bg-zinc-100 sm:gap-2.5 sm:pr-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr p-[2px] shadow-sm ${meta.ring}`}>
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-bold text-zinc-700">
            {initials(displayName)}
          </span>
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight text-zinc-900 lg:max-w-[14rem]">
            {displayName || "…"}
          </span>
          <span className="block text-xs leading-tight text-zinc-500">{meta.subtitle}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-zinc-400 transition group-data-[open]:rotate-180 sm:block" aria-hidden />
      </MenuButton>
      <MenuItems
        transition
        anchor="bottom end"
        className="z-50 w-64 origin-top-right rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10 outline-none transition duration-150 ease-out [--anchor-gap:8px] data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-sm font-bold text-white ${meta.ring}`}>
            {initials(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
            <p className="text-xs text-zinc-500">{meta.subtitle}</p>
          </div>
        </div>
        <div className="my-1 h-px bg-zinc-100" />
        <MenuItem>
          <Link href={profileHref} className={itemClass}>
            <UserRound className="h-4 w-4 text-zinc-400" aria-hidden /> Your profile
          </Link>
        </MenuItem>
        <div className="px-2.5 pb-2 pt-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Appearance</p>
          <ThemeToggle variant="segmented" block />
        </div>
        <div className="my-1 h-px bg-zinc-100" />
        <MenuItem>
          <button type="button" onClick={logout} className={`${itemClass} data-[focus]:bg-red-50 data-[focus]:text-red-700`}>
            <LogOut className="h-4 w-4 text-zinc-400" aria-hidden /> Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

function GlobalSearch({ placeholder, to }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const data = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
      const flat = flattenSearchResults(data);
      setResults(flat.slice(0, 8));
      setOpen(flat.length > 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(v), 300);
  };

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      {searching ? (
        <Loader2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      )}
      <input
        type="search"
        value={query}
        onChange={onChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-zinc-200/90 bg-zinc-100/60 py-2 pl-10 pr-16 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/15 sm:text-sm"
      />
      <button
        type="button"
        onClick={openCommandPalette}
        className="kbd absolute right-2.5 top-1/2 hidden -translate-y-1/2 transition hover:text-zinc-600 sm:inline-flex"
        title="Open command palette"
      >
        <Command className="h-3 w-3" aria-hidden />K
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="scroll-thin absolute left-0 right-0 top-full z-50 mt-2 max-h-80 origin-top overflow-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Results
            </p>
            {results.map((r, i) => {
              const href = RESULT_LINKS[r._type]?.(r, to) || "#";
              return (
                <a
                  key={`${r._type}-${r.id}-${i}`}
                  href={href}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition hover:bg-zinc-100"
                >
                  <span className="shrink-0 rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-700">
                    {r._type}
                  </span>
                  <span className="truncate font-medium text-zinc-800">{r.name || r.title || r.full_name || "—"}</span>
                  {r.subtitle && <span className="ml-auto truncate font-mono text-xs text-zinc-400">{r.subtitle}</span>}
                </a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardLayout({ children, userRole = "admin" }) {
  const { to } = useTenantPaths();
  const pathname = usePathname();
  const { user, role: sessionRole } = useSession();
  // Finance and payroll pages live under /admin but are shared with opsadmin,
  // so the chrome follows the signed-in user rather than the route.
  const role = (sessionRole && ROLE_META[sessionRole] ? sessionRole : null) || userRole;
  const meta = ROLE_META[role] || ROLE_META.admin;
  const displayName = user?.full_name || DISPLAY_FALLBACK[userRole] || "User";
  const [institution, setInstitution] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      const instRaw = localStorage.getItem("institution");
      setInstitution(instRaw && instRaw !== "null" ? JSON.parse(instRaw) : null);
    } catch {
      setInstitution(null);
    }
  }, [userRole]);

  useEffect(() => {
    const closeOnWide = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setMobileNavOpen(false);
    };
    closeOnWide();
    window.addEventListener("resize", closeOnWide);
    return () => window.removeEventListener("resize", closeOnWide);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div className="relative flex min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-transparent">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 420px at 80% -10%, rgba(136, 179, 138, 0.14), transparent 50%), radial-gradient(700px 380px at 0% 0%, rgba(99, 102, 241, 0.06), transparent 45%)",
        }}
      />

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Sidebar
        userRole={role}
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <NotificationListener userRole={role} />

      <div className="flex min-w-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] lg:pl-64 lg:pb-0">
        <header className="glass sticky top-0 z-20 border-b border-zinc-200/70 pt-[env(safe-area-inset-top)]">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 lg:flex-nowrap lg:px-8">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="app-sidebar"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" aria-hidden /> : <MenuIcon className="h-5 w-5" aria-hidden />}
            </button>

            {institution && role !== "mai_admin" && (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/90 px-2 py-1.5 sm:max-w-xs sm:flex-none lg:hidden">
                {institution.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={institution.logo_url} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-800">
                    {institution.name?.slice(0, 1) || "I"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-900">{institution.name}</p>
                  <p className="truncate text-[10px] text-zinc-500">{institution.slug}</p>
                </div>
              </div>
            )}

            <div className="order-last w-full lg:order-none lg:w-auto lg:max-w-xl lg:flex-1">
              <GlobalSearch placeholder={meta.searchPlaceholder} to={to} />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
              <ThemeToggle />
              <NotificationBell />
              <div className="mx-1 hidden h-6 w-px bg-zinc-200 sm:block" aria-hidden />
              <ProfileMenu
                displayName={displayName}
                meta={meta}
                role={role}
                profileHref={role === "mai_admin" ? "/profile" : to("/profile")}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          <motion.div
            key={pathname}
            className="mx-auto w-full max-w-[1600px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {role !== "mai_admin" && <ChatWidget userRole={role} />}
      <CommandPalette />
    </div>
  );
}
