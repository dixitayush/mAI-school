"use client";

import {
  GraduationCap,
  BookOpen,
  LogOut,
  FileText,
  User,
  LayoutDashboard,
  CheckCircle,
  Calendar,
  Megaphone,
  DollarSign,
  School,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTenantPaths } from "@/lib/useTenantPaths";
import {
  getInstitutionFromStorage,
  tenantLoginPath,
  tenantAppPath,
} from "@/lib/tenant";

const menuItems = {
  mai_admin: [
    { name: "Platform", href: "/mai-admin", icon: LayoutDashboard },
    { name: "Profile", href: "/profile", icon: User },
  ],
  admin: [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Students", href: "/admin/users/students", icon: GraduationCap },
    { name: "Teachers", href: "/admin/users/teachers", icon: BookOpen },
    { name: "Classes", href: "/admin/classes", icon: BookOpen },
    { name: "Attendance", href: "/admin/attendance", icon: CheckCircle },
    { name: "Fees", href: "/admin/fees", icon: DollarSign },
    { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { name: "Exams", href: "/exams", icon: FileText },
    { name: "Profile", href: "/profile", icon: User },
  ],
  teacher: [
    { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { name: "Attendance", href: "/teacher/attendance", icon: CheckCircle },
    { name: "Exams", href: "/teacher/exams", icon: FileText },
    { name: "Profile", href: "/profile", icon: User },
  ],
  principal: [
    { name: "Dashboard", href: "/principal", icon: LayoutDashboard },
    { name: "Calendar", href: "/principal/calendar", icon: Calendar },
    { name: "Students", href: "/admin/users/students", icon: GraduationCap },
    { name: "Teachers", href: "/admin/users/teachers", icon: BookOpen },
    { name: "Fees", href: "/admin/fees", icon: DollarSign },
    { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { name: "Exams", href: "/exams", icon: FileText },
    { name: "Profile", href: "/profile", icon: User },
  ],
  student: [
    { name: "Dashboard", href: "/student", icon: LayoutDashboard },
    { name: "Exams", href: "/exams", icon: FileText },
    { name: "Profile", href: "/profile", icon: User },
  ],
};

export default function Sidebar({
  userRole = "admin",
  mobileOpen = false,
  onNavigate,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { slug: pathTenantSlug } = useTenantPaths();
  const items = useMemo(() => {
    const raw = menuItems[userRole] || menuItems.admin;
    if (userRole === "mai_admin") return raw;
    return raw.map((item) => ({
      ...item,
      href: tenantAppPath(pathTenantSlug, item.href),
    }));
  }, [userRole, pathTenantSlug]);
  const layoutId = `sidebar-active-${userRole}`;
  const [institution, setInstitution] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("institution");
      setInstitution(raw && raw !== "null" ? JSON.parse(raw) : null);
    } catch {
      setInstitution(null);
    }
  }, []);

  const handleLogout = () => {
    const inst = getInstitutionFromStorage();
    const effectiveSlug =
      userRole === "mai_admin" ? "" : pathTenantSlug || inst?.slug || "";
    const dest =
      userRole === "mai_admin"
        ? "/login"
        : tenantLoginPath(effectiveSlug) || "/login";
    localStorage.clear();
    router.push(dest);
    onNavigate?.();
  };

  return (
    <aside
      id="app-sidebar"
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-zinc-200/80 bg-white pt-[env(safe-area-inset-top)] shadow-sm shadow-zinc-200/40 transition-transform duration-200 ease-out sm:w-64 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="border-b border-zinc-100 px-4 pb-4 pt-5 sm:px-5 sm:pt-6">
        <div className="flex items-center gap-3">
          {userRole === "mai_admin" ? (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-md ring-4 ring-white">
                <School className="h-6 w-6 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight text-zinc-900">MAI Platform</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Technical admin
                </p>
              </div>
            </>
          ) : institution ? (
            <>
              {institution.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={institution.logo_url}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-4 ring-white shadow-md"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-500/25 ring-4 ring-white">
                  <School className="h-6 w-6 text-white" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight text-zinc-900">
                  {institution.name}
                </p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  mAI-school · {institution.slug}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-500/25 ring-4 ring-white">
                <School className="h-6 w-6 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight text-zinc-900">mAI-school</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Workspace
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <nav
        className="sidebar-nav-scroll flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 py-3 sm:px-3 sm:py-4"
        aria-label="Main navigation"
      >
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <motion.a
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.99 }}
              className={`group relative flex min-h-[44px] items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-800 shadow-sm ring-1 ring-primary-500/10"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 -z-10 rounded-xl bg-primary-50"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <Icon
                strokeWidth={isActive ? 2.5 : 2}
                className={`h-5 w-5 shrink-0 ${
                  isActive ? "text-primary-600" : "text-zinc-400 group-hover:text-zinc-600"
                }`}
                aria-hidden
              />
              <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.name}
              </span>
            </motion.a>
          );
        })}
      </nav>

      <div className="border-t border-zinc-100 p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut
            className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          <span className="text-sm font-semibold">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
