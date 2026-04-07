"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Menu, Search, User, X } from "lucide-react";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import NotificationListener from "@/components/NotificationListener";
import { useTenantPaths } from "@/lib/useTenantPaths";

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
  const { to } = useTenantPaths();
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
    <div className="relative flex min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased">
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
          className="fixed inset-0 z-30 bg-zinc-900/40 backdrop-blur-sm lg:hidden"
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

      <div className="flex min-w-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] lg:pl-64 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
          <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 lg:hidden"
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

              {institution && userRole !== "mai_admin" && (
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 px-2.5 py-1.5 sm:max-w-md sm:flex-none sm:px-3">
                  {institution.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={institution.logo_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-800">
                      {institution.name?.slice(0, 1) || "I"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-900">{institution.name}</p>
                    <p className="truncate text-[10px] text-zinc-500">{institution.slug}</p>
                  </div>
                </div>
              )}

              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
                <button
                  type="button"
                  className="relative flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" aria-hidden />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
                </button>

                <Link
                  href={userRole === "mai_admin" ? "/profile" : to("/profile")}
                  className="flex min-w-0 items-center gap-2 rounded-2xl py-1 pl-1 pr-1.5 transition hover:bg-zinc-100 sm:gap-3 sm:pr-3"
                >
                  <div
                    className={`hidden min-w-0 text-right sm:block ${displayName ? "" : "min-w-[5rem]"}`}
                  >
                    <p className="max-w-[10rem] truncate text-sm font-semibold text-zinc-900 lg:max-w-[14rem]">
                      {displayName || "…"}
                    </p>
                    <p className="text-xs text-zinc-500">{meta.subtitle}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr p-0.5 shadow-sm ring-2 ring-white sm:h-11 sm:w-11 ${meta.ring}`}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                      <User className="h-5 w-5 text-zinc-400" aria-hidden />
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="relative w-full min-w-0 lg:max-w-2xl xl:max-w-3xl">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                placeholder={meta.searchPlaceholder}
                className="h-11 w-full min-h-[44px] rounded-full border border-zinc-200/90 bg-zinc-50/80 py-2 pl-10 pr-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/15 sm:text-sm"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
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
