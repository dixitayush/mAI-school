"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Globe,
  GraduationCap,
  Headphones,
  LineChart,
  Mail,
  Menu,
  MessageSquare,
  PenLine,
  Phone,
  School,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

const LANDING_NAV_LINKS = [
  ["/onboarding", "Start online"],
  ["#how-it-works", "How it works"],
  ["#features", "Features"],
  ["#pricing", "Pricing"],
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

const productFeatures = [
  {
    icon: ClipboardCheck,
    title: "Attendance everyone can trust",
    description:
      "Mark and review attendance with clarity—teachers save time and parents stay in the loop without chasing paper.",
  },
  {
    icon: PenLine,
    title: "Exams & academics in one flow",
    description:
      "Plan assessments, capture results, and give leadership a clear read on progress across classes and terms.",
  },
  {
    icon: Wallet,
    title: "Fees without the friction",
    description:
      "Track what is due, what is paid, and who needs a nudge—finance teams see the picture; families see transparency.",
  },
  {
    icon: MessageSquare,
    title: "Announcements that actually land",
    description:
      "Share updates with the right people at the right time, tied to your school—not lost in group chats.",
  },
  {
    icon: Globe,
    title: "Your institute’s own sign-in",
    description:
      "Each school gets a dedicated subdomain and optional branding on the login page. Staff and students use your link; MAI platform operations stay on the main site.",
  },
  {
    icon: Users,
    title: "Spaces for every role",
    description:
      "Admins, principals, teachers, and students each get a focused home—less noise, more of the work that matters.",
  },
  {
    icon: Sparkles,
    title: "Helpful AI for your staff",
    description:
      "Smart assists for drafting, summarizing, and everyday tasks—so your team spends energy on students, not busywork.",
  },
];

const onboardingSteps = [
  {
    step: 1,
    icon: Phone,
    title: "Choose how you start",
    description:
      "Start online in minutes with self-serve onboarding (name, slug, logo, student count, first admin)—or talk to sales for a guided contract and white-glove setup.",
    bullets: [
      "Self-serve: fixed ₹30 INR per student per month, tenant created instantly",
      "Sales-led: same platform, with scope, commercials, and kickoff on your calendar",
      "Either way you get a dedicated subdomain and isolated institute data",
    ],
  },
  {
    step: 2,
    icon: PenLine,
    title: "Agree & close",
    description:
      "We align on scope, commercials, and timelines. When the deal is signed, we move straight to setup.",
    bullets: [
      "Scope and rollout plan matched to your academic calendar",
      "Commercials agreed with full clarity—no surprise line items",
      "Kickoff scheduled with sales and technical specialists",
    ],
  },
  {
    step: 3,
    icon: UserPlus,
    title: "We provision your tenant",
    description:
      "We create your institute on the platform—its own subdomain, isolated data, and your first institute admin. You get a shareable login URL for your school’s team.",
    bullets: [
      "Dedicated subdomain and optional logo on the institute login page",
      "Primary institute admin credentials go to your designated lead",
      "MAI operations use the main platform; your campus uses your school link only",
    ],
  },
  {
    step: 4,
    icon: GraduationCap,
    title: "You roll out to campus",
    description:
      "Your admin signs in at your institute’s URL, invites staff, configures classes and fees, and your tenant is live—supported by us at go-live.",
    bullets: [
      "Everyone signs in on your subdomain—not the main marketing or platform URL",
      "Invite teachers, principals, and staff with the right roles",
      "Configure classes, fees, and announcements at your pace with hands-on support",
    ],
  },
];

function HowItWorksInteractive() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const tabId = useId();
  const panelId = `${tabId}-panel`;
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const go = useCallback((index) => {
    const next = Math.max(0, Math.min(onboardingSteps.length - 1, index));
    setActive(next);
  }, []);

  const onPanelKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        go(active + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(active - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(onboardingSteps.length - 1);
      }
    },
    [active, go]
  );

  const current = onboardingSteps[active];
  const progress = ((active + 1) / onboardingSteps.length) * 100;
  const activeTabLabelId = isLargeScreen
    ? `${tabId}-dtab-${active}`
    : `${tabId}-mtab-${active}`;

  return (
    <div
      className="mx-auto mt-14 max-w-5xl lg:mt-16"
      role="region"
      aria-label="How institutes get started on mAI-school"
    >
      <div className="mb-8 space-y-4">
        <div
          className="flex h-2 overflow-hidden rounded-full bg-zinc-200/90 p-0.5 shadow-inner"
          aria-hidden
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
            }
          />
        </div>
        {/* Mobile / tablet stepper */}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-between sm:gap-3 lg:hidden" role="tablist" aria-label="Onboarding steps">
          {onboardingSteps.map((item, i) => {
            const isActive = i === active;
            return (
              <button
                key={item.step}
                type="button"
                role="tab"
                id={`${tabId}-mtab-${i}`}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => go(i)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:flex-initial sm:px-4 ${
                  isActive
                    ? "border-primary-300 bg-white text-primary-900 shadow-md shadow-primary-900/5 ring-2 ring-primary-500/20"
                    : "border-zinc-200/90 bg-white/60 text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive ? "bg-primary-600 text-white" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {item.step}
                </span>
                <span className="hidden truncate sm:inline">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10 lg:items-stretch">
        {/* Desktop vertical rail — sole tablist on lg */}
        <div
          className="hidden lg:col-span-5 lg:flex lg:flex-col lg:gap-0"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {onboardingSteps.map((item, i) => {
            const isActive = i === active;
            const isPast = i < active;
            return (
              <div key={item.step} className="flex gap-4">
                <div className="flex w-11 shrink-0 flex-col items-center">
                  <button
                    type="button"
                    role="tab"
                    id={`${tabId}-dtab-${i}`}
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => go(i)}
                    className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
                      isActive
                        ? "bg-primary-600 text-white shadow-primary-600/25 ring-4 ring-primary-100"
                        : isPast
                          ? "bg-primary-100 text-primary-800 ring-2 ring-primary-200/80 hover:bg-primary-200/80"
                          : "bg-zinc-100 text-zinc-500 ring-2 ring-transparent hover:bg-zinc-200"
                    }`}
                  >
                    {isPast ? <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : item.step}
                  </button>
                  {i < onboardingSteps.length - 1 && (
                    <div className="relative mt-1 h-12 w-0.5 shrink-0" aria-hidden>
                      <div className="absolute inset-0 rounded-full bg-zinc-200" />
                      <motion.div
                        className="absolute left-0 top-0 w-full rounded-full bg-primary-400"
                        initial={false}
                        animate={{
                          height:
                            i < active ? "100%" : i === active ? "50%" : "0%",
                        }}
                        transition={
                          reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                        }
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(i)}
                  className={`group mb-2 min-w-0 flex-1 rounded-2xl border px-5 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${
                    isActive
                      ? "border-primary-200 bg-white shadow-lg shadow-zinc-200/50 ring-1 ring-primary-500/10"
                      : "border-transparent bg-transparent hover:border-zinc-200/80 hover:bg-white/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                      <item.icon className="h-5 w-5" aria-hidden />
                    </span>
                    {isActive && (
                      <ChevronRight className="h-5 w-5 shrink-0 text-primary-500" aria-hidden />
                    )}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                </button>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-7">
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={activeTabLabelId}
            tabIndex={0}
            onKeyDown={onPanelKeyDown}
            className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xl shadow-zinc-200/40 outline-none ring-zinc-900/5 focus-visible:ring-2 focus-visible:ring-primary-500/30 sm:p-8 lg:min-h-[420px] lg:p-10"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-100/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-violet-100/40 blur-3xl" />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={transition}
                className="relative"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Step {current.step} of {onboardingSteps.length}
                  </span>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-600/25">
                    <current.icon className="h-6 w-6" aria-hidden />
                  </span>
                </div>
                <h3 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                  {current.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-zinc-600">
                  {current.description}
                </p>
                <ul className="mt-8 space-y-3">
                  {current.bullets.map((line) => (
                    <li key={line} className="flex gap-3 text-sm text-zinc-700">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                      </span>
                      <span className="leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10 flex flex-col gap-3 border-t border-zinc-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => go(active - 1)}
                      disabled={active === 0}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => go(active + 1)}
                      disabled={active === onboardingSteps.length - 1}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Next step
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Focus this card, then use arrow keys to move between steps.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-dvh bg-zinc-50 ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] text-zinc-900 antialiased">
      {/* Subtle page background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(136, 179, 138, 0.18), transparent 55%), radial-gradient(800px 400px at 100% 20%, rgba(99, 102, 241, 0.06), transparent 50%)",
        }}
      />

      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex min-h-[3.5rem] max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:min-h-[4.25rem] sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
            onClick={() => setMobileNavOpen(false)}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-500/25 ring-4 ring-white">
              <School className="h-5 w-5 text-white" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                mAI-school
              </span>
              <span className="hidden text-xs font-medium text-zinc-500 xs:block">
                School management
              </span>
            </div>
          </Link>
          <nav
            className="hidden items-center gap-0.5 rounded-full border border-zinc-200/80 bg-white/90 p-1 shadow-sm lg:flex xl:gap-1"
            aria-label="Primary"
          >
            {LANDING_NAV_LINKS.map(([href, label]) =>
              href.startsWith("/") ? (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 xl:px-4"
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={href}
                  href={href}
                  className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 xl:px-4"
                >
                  {label}
                </a>
              )
            )}
          </nav>
          <div className="hidden items-center gap-2 lg:flex lg:gap-3">
            <Link
              href="/login"
              className="rounded-full px-3 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 lg:px-4"
              title="MAI platform administrators only"
            >
              Platform sign in
            </Link>
            <a
              href="mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/15 transition hover:bg-zinc-800"
            >
              Contact sales
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </a>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <a
              href="mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales"
              className="inline-flex min-h-[44px] max-w-[44vw] items-center justify-center gap-1 rounded-full bg-zinc-900 px-3 text-xs font-semibold text-white shadow-md shadow-zinc-900/20 transition hover:bg-zinc-800 xs:max-w-none xs:gap-1.5 xs:px-4 xs:text-sm md:min-h-[48px] md:px-5 md:text-base"
            >
              <span className="truncate xs:max-w-none">
                <span className="xs:hidden">Sales</span>
                <span className="hidden xs:inline">Contact sales</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-90 xs:h-4 xs:w-4" aria-hidden />
            </a>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 md:h-12 md:w-12"
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileNavOpen && (
            <motion.div
              key="mobile-nav"
              id="landing-mobile-nav"
              role="navigation"
              aria-label="Mobile primary"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-zinc-200/80 bg-white/95 lg:hidden [&:focus-within]:outline-none"
            >
              <div className="max-h-[min(32rem,calc(100dvh-5rem))] space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-1 sm:px-5 sm:py-4 md:max-h-[min(36rem,calc(100dvh-4rem))]">
                {LANDING_NAV_LINKS.map(([href, label]) =>
                  href.startsWith("/") ? (
                    <Link
                      key={href}
                      href={href}
                      className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200 sm:min-h-[52px] sm:px-5 md:text-lg"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {label}
                    </Link>
                  ) : (
                    <a
                      key={href}
                      href={href}
                      className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200 sm:min-h-[52px] sm:px-5 md:text-lg"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {label}
                    </a>
                  )
                )}
                <div className="my-2 border-t border-zinc-100 sm:my-3" aria-hidden />
                <Link
                  href="/login"
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold text-zinc-700 transition hover:bg-zinc-100 active:bg-zinc-200 sm:min-h-[52px] sm:px-5 md:text-lg"
                  title="MAI platform administrators only"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Platform sign in
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 md:grid-cols-2 md:items-center md:gap-10 md:pb-20 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="flex min-w-0 flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200/80 bg-primary-50/90 px-3.5 py-1.5 text-xs font-semibold text-primary-800 shadow-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
              Multi-tenant · One platform, many schools
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.04 }}
              className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]"
            >
              The calm, modern way to{" "}
              <span className="bg-gradient-to-r from-primary-600 to-emerald-600 bg-clip-text text-transparent">
                run your institute
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600"
            >
              mAI-school brings attendance, fees, exams, and day-to-day communication
              together. Each institute gets its own subdomain, branded login, and isolated
              data—while MAI runs onboarding and operations from the main platform.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <a
                href="mailto:?subject=mAI-school%20%E2%80%94%20Talk%20to%20sales"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary-600 px-7 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
              >
                Talk to sales
                <ArrowRight className="h-5 w-5" aria-hidden />
              </a>
              <Link
                href="/onboarding"
                className="inline-flex h-12 items-center justify-center rounded-full border border-primary-200 bg-primary-50/90 px-7 text-base font-semibold text-primary-900 shadow-sm transition hover:border-primary-300 hover:bg-primary-50"
              >
                Start online
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-7 text-base font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                title="For MAI platform administrators only"
              >
                Platform admin sign in
              </Link>
            </motion.div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
              School staff and students: use the sign-in link your institute shared with you
              (your school’s subdomain)—not this page.
            </p>
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500"
            >
              <li className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-primary-600" aria-hidden />
                White-glove onboarding today
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary-600" aria-hidden />
                Go-live with our technical team
              </li>
              <li className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary-600" aria-hidden />
                Dedicated URL and tenant isolation
              </li>
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative min-w-0 md:mt-2 lg:mt-0 lg:pt-4"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary-100/50 via-white to-violet-100/40 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/90 bg-white shadow-2xl shadow-zinc-200/60 ring-1 ring-zinc-100">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-5 py-3.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                </div>
                <p className="truncate text-xs font-medium text-zinc-500">
                  <span className="font-mono text-zinc-400">riverside</span>
                  <span className="text-zinc-300"> · </span>
                  institute dashboard
                </p>
                <Bell className="h-4 w-4 text-zinc-400" aria-hidden />
              </div>
              <div className="space-y-5 p-6 sm:p-7">
                <div>
                  <p className="text-sm font-medium text-zinc-500">Good morning</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    Riverside International School
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                    <p className="text-xs font-medium text-zinc-500">Present today</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                      94%
                    </p>
                    <p className="mt-1 text-xs text-emerald-600">+2% vs last week</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                    <p className="text-xs font-medium text-zinc-500">Fees cleared</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                      128
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">This month</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-gradient-to-br from-white to-zinc-50/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <Mail className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        Fee reminder sent
                      </p>
                      <p className="text-xs text-zinc-500">
                        Grade 10 families · Scheduled send
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-2 flex-1 rounded-full bg-primary-200">
                    <div className="h-2 w-4/5 rounded-full bg-primary-500" />
                  </div>
                </div>
                <p className="text-center text-xs text-zinc-400">
                  Illustrative preview — each institute’s data and branding stay separate
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How institutes get started */}
      <section
        id="how-it-works"
        className="border-b border-zinc-200/80 bg-zinc-50 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              From first conversation to your whole campus
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              After we align on terms, we provision your tenant—subdomain, login page, and
              first institute admin—so your team can roll out from the right URL.
            </p>
          </motion.div>

          <HowItWorksInteractive />

          <motion.p
            {...fadeUp}
            className="mx-auto mt-14 max-w-2xl text-center text-sm text-zinc-500"
          >
            Questions before step one?{" "}
            <a
              href="mailto:?subject=mAI-school%20%E2%80%94%20Question%20before%20signup"
              className="font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-800"
            >
              Email us
            </a>{" "}
            — we typically reply within one business day.
          </motion.p>
        </div>
      </section>

      {/* Product features */}
      <section id="features" className="border-b border-zinc-200/80 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">
              Inside the product
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Less admin drag. More time for learning.
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              These are the outcomes schools tell us they feel first—not a spec sheet, just
              what your team gets to use every day.
            </p>
          </motion.div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {productFeatures.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.45, delay: i * 0.04 }}
                className="group relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-6 shadow-sm transition hover:border-primary-200/80 hover:bg-white hover:shadow-md lg:p-7"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-100/50 opacity-0 transition group-hover:opacity-100" />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-zinc-100">
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="relative mt-5 text-lg font-semibold text-zinc-900">
                  {f.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-zinc-600">
                  {f.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip — human, not technical */}
      <section className="border-b border-zinc-200/80 bg-gradient-to-b from-zinc-50 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-3xl border border-zinc-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-sm sm:grid-cols-3 sm:gap-6 sm:p-10">
            {[
              {
                icon: LineChart,
                title: "Leaders see the campus pulse",
                text: "Attendance, fees, and academics in one place—fewer spreadsheets, fewer surprises.",
              },
              {
                icon: Users,
                title: "Your data, your subdomain",
                text: "Tenants are isolated end to end—your attendance, fees, and users don’t mix with other institutes. Sign-in is on your school’s host, not a shared generic portal.",
              },
              {
                icon: Headphones,
                title: "People, not just software",
                text: "Sales and technical specialists help you from contract to first login and beyond.",
              },
            ].map((block) => (
              <div key={block.title} className="text-center sm:text-left">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 sm:mx-0">
                  <block.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-zinc-900">{block.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{block.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing & roadmap */}
      <section id="pricing" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Simple today. More choice on the way.
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              We work with you directly so pricing matches how your institute runs. Roadmap
              items below are planned—ask sales for timing in your region.
            </p>
          </motion.div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
            <motion.div
              {...fadeUp}
              className="flex flex-col rounded-3xl border-2 border-primary-500/30 bg-gradient-to-b from-primary-50/80 to-white p-8 shadow-md shadow-primary-900/5"
            >
              <p className="text-sm font-semibold text-primary-800">Available today</p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">Sales-led onboarding</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-600">
                Use{" "}
                <Link href="/onboarding" className="font-semibold text-primary-800 underline decoration-primary-300 underline-offset-2 hover:text-primary-900">
                  Start online
                </Link>{" "}
                for instant provisioning at ₹30 per student per month—or connect with sales for
                custom terms, subdomain, branded login, and a shareable URL for your campus.
              </p>
              <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  href="/onboarding"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary-600 px-5 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  Start online
                </Link>
                <a
                  href="mailto:?subject=mAI-school%20%E2%80%94%20Pricing%20discussion"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-primary-200 bg-white px-5 text-sm font-semibold text-primary-900 transition hover:bg-primary-50"
                >
                  Request pricing
                </a>
              </div>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.06 }}
              className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8"
            >
              <p className="text-sm font-semibold text-zinc-500">On the roadmap</p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">Payments &amp; scale</h3>
              <ul className="mt-5 space-y-4 text-sm text-zinc-600">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-700 shadow-sm ring-1 ring-zinc-200">
                    1
                  </span>
                  <span>
                    <strong className="text-zinc-800">In-app billing &amp; invoices</strong> —
                    self-serve institutes are created today; automated payments and receipts
                    are on the way.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-700 shadow-sm ring-1 ring-zinc-200">
                    2
                  </span>
                  <span>
                    <strong className="text-zinc-800">Student-based pricing</strong> — ₹30 per
                    student per month (billable headcount is the higher of enrolled students
                    or your declared estimate).
                  </span>
                </li>
              </ul>
              <p className="mt-6 text-xs text-zinc-500">
                Roadmap features and dates vary by market; your sales contact can share the
                latest.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-zinc-200/80 bg-zinc-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div {...fadeUp}>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Bring mAI-school to your institute
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-zinc-400">
              Start with a conversation—we provision your tenant and institute admin so your
              team can sign in on your subdomain and focus on students.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <a
                href="mailto:?subject=mAI-school%20%E2%80%94%20Get%20started"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 sm:w-auto"
              >
                Contact sales
                <ArrowRight className="h-5 w-5" aria-hidden />
              </a>
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-600 bg-transparent px-8 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                title="MAI platform administrators only"
              >
                Platform admin sign in
              </Link>
            </div>
            <p className="mx-auto mt-4 max-w-md text-center text-xs text-zinc-500">
              Institute staff and students: use your school’s sign-in link—not the platform
              button above.
            </p>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600">
              <School className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="font-semibold text-zinc-900">mAI-school</span>
          </div>
          <p className="text-center text-sm text-zinc-500 sm:text-right">
            © {new Date().getFullYear()} mAI-school. School management for modern institutes.
          </p>
        </div>
      </footer>
    </div>
  );
}
