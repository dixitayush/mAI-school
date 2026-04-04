"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Menu, Search, User, X } from "lucide-react";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import NotificationListener from "@/components/NotificationListener";

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
  student: "Student",
};

export default function DashboardLayout({ children, userRole = "admin" }) {
  const meta = ROLE_META[userRole] || ROLE_META.admin;
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.full_name) {
          setDisplayName(p.full_name);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setDisplayName(DISPLAY_FALLBACK[userRole] || "User");
    try {
      const instRaw = localStorage.getItem("institution");
      if (instRaw && instRaw !== "null") {
        setInstitution(JSON.parse(instRaw));
      } else {
        setInstitution(null);
      }
    } catch {
      setInstitution(null);
    }
  }, [userRole]);

  useEffect(() => {
    const closeOnWide = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setMobileNavOpen(false);
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
    <div className="relative flex min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 420px at 80% -10%, rgba(136, 179, 138, 0.12), transparent 50%), radial-gradient(700px 380px at 0% 0%, rgba(99, 102, 241, 0.05), transparent 45%)",
        }}
      />

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-zinc-900/40 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Sidebar
        userRole={userRole}
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <NotificationListener userRole={userRole} />

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="app-sidebar"
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-3">
              {institution && userRole !== "mai_admin" && (
                <div className="hidden min-w-0 shrink-0 items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 px-3 py-1.5 sm:flex">
                  {institution.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={institution.logo_url}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-800">
                      {institution.name?.slice(0, 1) || "I"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-900">{institution.name}</p>
                    <p className="truncate text-[10px] text-zinc-500">{institution.slug}</p>
                  </div>
                </div>
              )}
              <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-xl">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder={meta.searchPlaceholder}
                  className="h-10 w-full rounded-full border border-zinc-200/90 bg-zinc-50/80 py-2 pl-10 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/15"
                />
              </div>
              <div className="flex min-w-0 flex-1 md:hidden">
                <div className="relative w-full">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    placeholder="Search…"
                    className="h-10 w-full rounded-full border border-zinc-200/90 bg-zinc-50/80 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-500/15"
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <button
                type="button"
                className="relative rounded-full p-2 text-zinc-600 transition hover:bg-zinc-100"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" aria-hidden />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
              </button>

              <Link
                href="/profile"
                className="flex items-center gap-3 rounded-2xl py-1 pl-1 pr-2 transition hover:bg-zinc-100 sm:pl-2 sm:pr-3"
              >
                <div
                  className={`hidden text-right sm:block ${displayName ? "" : "min-w-[5rem]"}`}
                >
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {displayName || "…"}
                  </p>
                  <p className="text-xs text-zinc-500">{meta.subtitle}</p>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr p-0.5 shadow-sm ring-2 ring-white ${meta.ring}`}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                    <User className="h-5 w-5 text-zinc-400" aria-hidden />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
