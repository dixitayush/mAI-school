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
  CalendarRange,
  Megaphone,
  DollarSign,
  School,
  Settings,
  IdCard,
  ClipboardList,
  CalendarClock,
  Video,
  Receipt,
  Layers,
  Tags,
  Wallet,
  UserCog,
  Banknote,
  Users,
  Shield,
  Palette,
  ToggleRight,
  Bell,
  CreditCard,
  ClipboardCheck,
  FolderOpen,
  LifeBuoy,
  CalendarOff,
  BookMarked,
  Bus,
  Package,
  BarChart3,
  ShieldCheck,
  Workflow,
  CalendarDays,
  ArrowUpDown,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  Brain,
  Bot,
  Search,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTenantPaths } from "@/lib/useTenantPaths";
import { useLogout } from "@/lib/useLogout";
import { tenantAppPath } from "@/lib/tenant";

/*
 * Navigation per role, as labelled sections. A section with no label renders
 * as a plain list (short menus don't need headings).
 */
const menuSections = {
  mai_admin: [
    {
      items: [
        { name: "Platform", href: "/mai-admin", icon: LayoutDashboard },
        { name: "Billing", href: "/mai-admin/billing", icon: CreditCard },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
  admin: [
    {
      items: [{ name: "Dashboard", href: "/admin", icon: LayoutDashboard }],
    },
    {
      label: "People",
      items: [
        { name: "Students", href: "/admin/users/students", icon: GraduationCap },
        { name: "Teachers", href: "/admin/users/teachers", icon: BookOpen },
        { name: "Staff Accounts", href: "/admin/users", icon: Users },
        { name: "Admissions", href: "/admin/admissions", icon: ClipboardCheck },
      ],
    },
    {
      label: "Academics",
      items: [
        { name: "Classes", href: "/admin/classes", icon: BookOpen },
        { name: "Sessions", href: "/admin/sessions", icon: CalendarRange },
        { name: "Attendance", href: "/admin/attendance", icon: CheckCircle },
        { name: "Exams", href: "/exams", icon: FileText },
        { name: "Admit Cards", href: "/admin/admit-cards", icon: IdCard },
        { name: "Timetable", href: "/admin/timetable", icon: CalendarClock },
        { name: "Online Classes", href: "/admin/online-classes", icon: Video },
        { name: "Certificates", href: "/admin/certificates", icon: FileText },
        { name: "Interventions", href: "/admin/interventions", icon: AlertTriangle },
      ],
    },
    {
      label: "Finance",
      items: [
        { name: "Fees", href: "/admin/fees", icon: DollarSign },
        { name: "Fee Heads", href: "/admin/fees/heads", icon: Tags },
        { name: "Fee Plans", href: "/admin/fees/plans", icon: Layers },
        { name: "Invoices", href: "/admin/fees/invoices", icon: Receipt },
        { name: "Payroll", href: "/admin/payroll", icon: Wallet },
        { name: "Salary Planner", href: "/admin/payroll/structures", icon: UserCog },
        { name: "Expenses", href: "/admin/expenses", icon: Banknote },
      ],
    },
    {
      label: "Campus",
      items: [
        { name: "Holidays", href: "/admin/holidays", icon: Calendar },
        { name: "Events", href: "/admin/events", icon: CalendarDays },
        { name: "Leave", href: "/admin/leave", icon: CalendarOff },
        { name: "Library", href: "/admin/library", icon: BookMarked },
        { name: "Transport", href: "/admin/transport", icon: Bus },
        { name: "Inventory", href: "/admin/inventory", icon: Package },
        { name: "Documents", href: "/admin/documents", icon: FolderOpen },
        { name: "Helpdesk", href: "/admin/helpdesk", icon: LifeBuoy },
      ],
    },
    {
      label: "Engagement",
      items: [
        { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
        { name: "Communication", href: "/admin/communication", icon: MessageSquare },
        { name: "Notifications", href: "/admin/notifications", icon: Bell },
        { name: "Surveys", href: "/admin/surveys", icon: BarChart3 },
        { name: "Consent", href: "/admin/consent", icon: ShieldCheck },
      ],
    },
    {
      label: "Administration",
      items: [
        { name: "School Setup", href: "/admin/setup", icon: Sparkles },
        { name: "Workflows", href: "/admin/workflows", icon: Workflow },
        { name: "Import/Export", href: "/admin/imports", icon: ArrowUpDown },
        { name: "AI Governance", href: "/admin/ai-governance", icon: Brain },
        { name: "Security", href: "/admin/security", icon: Shield },
        { name: "Audit Log", href: "/admin/audit", icon: Shield },
        { name: "Branding", href: "/admin/branding", icon: Palette },
        { name: "Features", href: "/admin/feature-flags", icon: ToggleRight },
        { name: "Settings", href: "/admin/settings", icon: Settings },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
  opsadmin: [
    {
      items: [{ name: "Dashboard", href: "/opsadmin", icon: LayoutDashboard }],
    },
    {
      label: "Finance",
      items: [
        { name: "Fees", href: "/admin/fees", icon: DollarSign },
        { name: "Fee Heads", href: "/admin/fees/heads", icon: Tags },
        { name: "Fee Plans", href: "/admin/fees/plans", icon: Layers },
        { name: "Invoices", href: "/admin/fees/invoices", icon: Receipt },
        { name: "Payroll", href: "/admin/payroll", icon: Wallet },
        { name: "Salary Planner", href: "/admin/payroll/structures", icon: UserCog },
        { name: "Expenses", href: "/admin/expenses", icon: Banknote },
      ],
    },
    {
      label: "People",
      items: [
        { name: "Students", href: "/admin/users/students", icon: GraduationCap },
        { name: "Teachers", href: "/admin/users/teachers", icon: BookOpen },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
  teacher: [
    {
      items: [{ name: "Dashboard", href: "/teacher", icon: LayoutDashboard }],
    },
    {
      label: "Classroom",
      items: [
        { name: "Attendance", href: "/teacher/attendance", icon: CheckCircle },
        { name: "Exams", href: "/teacher/exams", icon: FileText },
        { name: "Assignments", href: "/teacher/assignments", icon: ClipboardList },
        { name: "Timetable", href: "/teacher/timetable", icon: CalendarClock },
        { name: "Online Classes", href: "/teacher/online-classes", icon: Video },
        { name: "AI Studio", href: "/teacher/ai-studio", icon: Sparkles },
        { name: "Interventions", href: "/teacher/interventions", icon: AlertTriangle },
      ],
    },
    {
      label: "Me",
      items: [
        { name: "My Salary", href: "/teacher/salary", icon: Wallet },
        { name: "Leave", href: "/teacher/leave", icon: CalendarOff },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
  principal: [
    {
      items: [
        { name: "Dashboard", href: "/principal", icon: LayoutDashboard },
        { name: "Calendar", href: "/principal/calendar", icon: Calendar },
        { name: "AI Insights", href: "/principal/ai-insights", icon: Brain },
      ],
    },
    {
      label: "People",
      items: [
        { name: "Students", href: "/admin/users/students", icon: GraduationCap },
        { name: "Teachers", href: "/admin/users/teachers", icon: BookOpen },
      ],
    },
    {
      label: "Academics",
      items: [
        { name: "Exams", href: "/exams", icon: FileText },
        { name: "Admit Cards", href: "/admin/admit-cards", icon: IdCard },
        { name: "Timetable", href: "/admin/timetable", icon: CalendarClock },
        { name: "Online Classes", href: "/admin/online-classes", icon: Video },
        { name: "Interventions", href: "/principal/interventions", icon: AlertTriangle },
      ],
    },
    {
      label: "Finance",
      items: [
        { name: "Fees", href: "/admin/fees", icon: DollarSign },
        { name: "Fee Plans", href: "/admin/fees/plans", icon: Layers },
        { name: "Invoices", href: "/admin/fees/invoices", icon: Receipt },
        { name: "Payroll", href: "/admin/payroll", icon: Wallet },
        { name: "Expenses", href: "/admin/expenses", icon: Banknote },
      ],
    },
    {
      label: "Campus",
      items: [
        { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
        { name: "Holidays", href: "/admin/holidays", icon: Calendar },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
  parent: [
    {
      items: [
        { name: "Dashboard", href: "/parent", icon: LayoutDashboard },
        { name: "Messages", href: "/parent/communication", icon: MessageSquare },
        { name: "Events", href: "/parent/events", icon: CalendarDays },
        { name: "Consent", href: "/parent/consent", icon: ShieldCheck },
        { name: "Settings", href: "/parent/settings", icon: Settings },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
  student: [
    {
      items: [{ name: "Dashboard", href: "/student", icon: LayoutDashboard }],
    },
    {
      label: "Learning",
      items: [
        { name: "Exams", href: "/exams", icon: FileText },
        { name: "Assignments", href: "/student/assignments", icon: ClipboardList },
        { name: "Timetable", href: "/student/timetable", icon: CalendarClock },
        { name: "Online Classes", href: "/student/online-classes", icon: Video },
        { name: "AI Tutor", href: "/student/ai-tutor", icon: Bot },
        { name: "Study Planner", href: "/student/study-planner", icon: Sparkles },
      ],
    },
    {
      label: "Me",
      items: [
        { name: "My Fees", href: "/student/fees", icon: Receipt },
        { name: "Portfolio", href: "/student/portfolio", icon: FolderOpen },
        { name: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
};

// Menus longer than this get a "Jump to…" filter.
const FILTER_THRESHOLD = 14;

function BrandMark({ userRole, institution }) {
  if (userRole === "mai_admin") {
    return (
      <>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-md">
          <School className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold tracking-tight text-zinc-900">MAI Platform</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Technical admin</p>
        </div>
      </>
    );
  }
  return (
    <>
      {institution?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={institution.logo_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md ring-1 ring-zinc-900/5"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-500/25">
          <School className="h-5 w-5 text-white" aria-hidden />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold tracking-tight text-zinc-900">
          {institution?.name || "mAI-school"}
        </p>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {institution ? `mAI-school · ${institution.slug}` : "Workspace"}
        </p>
      </div>
    </>
  );
}

export default function Sidebar({
  userRole = "admin",
  mobileOpen = false,
  onNavigate,
}) {
  const pathname = usePathname();
  const { slug: pathTenantSlug } = useTenantPaths();
  const logout = useLogout(userRole);
  const [institution, setInstitution] = useState(null);
  const [filter, setFilter] = useState("");
  const navRef = useRef(null);

  const sections = useMemo(() => {
    const raw = menuSections[userRole] || menuSections.admin;
    if (userRole === "mai_admin") return raw;
    return raw.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        href: tenantAppPath(pathTenantSlug, item.href),
      })),
    }));
  }, [userRole, pathTenantSlug]);

  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);
  const showFilter = totalItems > FILTER_THRESHOLD;

  // Highlight only the most specific match, so /admin/fees/heads lights up
  // "Fee Heads" rather than Dashboard, Fees and Fee Heads together.
  const activeHref = useMemo(() => {
    let best = "";
    for (const s of sections) {
      for (const { href } of s.items) {
        if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > best.length) {
          best = href;
        }
      }
    }
    return best;
  }, [sections, pathname]);

  const visibleSections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) => i.name.toLowerCase().includes(q) || s.label?.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, filter]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("institution");
      setInstitution(raw && raw !== "null" ? JSON.parse(raw) : null);
    } catch {
      setInstitution(null);
    }
  }, []);

  // Long menus: keep the current page in view on load.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeHref]);

  const handleLogout = () => {
    logout();
    onNavigate?.();
  };

  const onFilterKeyDown = (e) => {
    if (e.key === "Escape") setFilter("");
    if (e.key === "Enter") {
      const first = visibleSections[0]?.items[0];
      if (first) window.location.href = first.href;
    }
  };

  return (
    <aside
      id="app-sidebar"
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-zinc-200/80 bg-white/95 pt-[env(safe-area-inset-top)] shadow-xl shadow-zinc-900/5 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-64 lg:translate-x-0 lg:shadow-none ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="px-4 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <BrandMark userRole={userRole} institution={institution} />
        </div>

        {showFilter && (
          <div className="group relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-600"
              aria-hidden
            />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={onFilterKeyDown}
              placeholder="Jump to…"
              aria-label="Filter menu"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-8 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>

      <nav
        ref={navRef}
        className="sidebar-nav-scroll scroll-thin flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-4"
        aria-label="Main navigation"
      >
        {visibleSections.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-zinc-400">No menu items match “{filter}”.</p>
        )}
        {visibleSections.map((section, si) => (
          <div key={section.label || `s${si}`} className={si > 0 ? "mt-5" : "mt-1"}>
            {section.label && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "font-semibold text-primary-800"
                        : "font-medium text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={`sidebar-active-${userRole}`}
                        className="absolute inset-0 rounded-lg bg-primary-50 ring-1 ring-primary-500/15"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      >
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-[5px] -translate-y-1/2 rounded-full bg-primary-600" />
                      </motion.span>
                    )}
                    <Icon
                      strokeWidth={isActive ? 2.25 : 1.9}
                      className={`relative h-[18px] w-[18px] shrink-0 transition-colors ${
                        isActive ? "text-primary-600" : "text-zinc-400 group-hover:text-zinc-600"
                      }`}
                      aria-hidden
                    />
                    <span className="relative truncate">{item.name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleLogout}
          className="group flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut
            className="h-[18px] w-[18px] transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          <span className="text-sm font-semibold">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
